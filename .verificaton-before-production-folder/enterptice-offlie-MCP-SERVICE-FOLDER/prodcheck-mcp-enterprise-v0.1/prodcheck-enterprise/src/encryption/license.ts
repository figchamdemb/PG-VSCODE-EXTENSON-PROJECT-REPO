import * as crypto from "crypto";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// ENTERPRISE ENCRYPTION MODULE
//
// HOW IT WORKS:
// 1. Your server generates an encrypted "rule pack" (.yrp file)
// 2. Rule pack is AES-256-GCM encrypted
// 3. Decryption key = PBKDF2(LICENSE_KEY + MACHINE_ID + INTERNAL_SALT)
// 4. INTERNAL_SALT is compiled into the binary (obfuscated via pkg)
// 5. Rules are decrypted IN MEMORY only — never written to disk
// 6. Rule pack has an expiry date — stops working after license period
//
// SECURITY LAYERS:
// Layer 1: AES-256-GCM encryption (military grade)
// Layer 2: Key derived from license + machine fingerprint (non-transferable)
// Layer 3: Internal salt compiled into binary (requires reverse engineering to extract)
// Layer 4: Rules only in memory (no temp files)
// Layer 5: Expiry timestamp inside encrypted payload (tamper-proof)
// Layer 6: Legal (DMCA + Terms of Service)
//
// CAN THEY CRACK IT?
// - They'd need to reverse-engineer the compiled binary to find the salt
// - Even then, the rule pack is tied to their machine ID
// - Practical security: Very high for commercial protection
// - Not suitable for nation-state adversaries (but that's not your threat model)
// ============================================================

// Internal salt — this gets compiled into the binary via `pkg`
// In production, use a longer, more complex salt and rotate it per version
const INTERNAL_SALT = "PG_v1_2026_xK9mR4nT8qW2pL5j";

// PBKDF2 parameters
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ============================================================
// MACHINE FINGERPRINT — Ties the license to a specific machine
// ============================================================

export function getMachineId(): string {
  const components = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || "unknown",
    os.totalmem().toString(),
    // Network interface MAC addresses (stable identifier)
    ...Object.values(os.networkInterfaces())
      .flat()
      .filter((iface) => iface && !iface.internal && iface.mac !== "00:00:00:00:00:00")
      .map((iface) => iface!.mac)
      .slice(0, 3),
  ];

  return crypto
    .createHash("sha256")
    .update(components.join("|"))
    .digest("hex")
    .substring(0, 32);
}

// ============================================================
// KEY DERIVATION — Derives the encryption key from license + machine + salt
// ============================================================

function deriveKey(licenseKey: string, machineId: string): Buffer {
  const combined = `${licenseKey}:${machineId}:${INTERNAL_SALT}`;
  return crypto.pbkdf2Sync(combined, INTERNAL_SALT, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
}

// ============================================================
// RULE PACK STRUCTURE (what's inside the encrypted payload)
// ============================================================

export interface RulePack {
  version: string;
  expiresAt: string; // ISO date — rule pack stops working after this
  issuedAt: string;
  licenseTier: "pro" | "enterprise";
  rules: EncryptedRule[];
  scoringWeights: Record<string, number>;
  severityOverrides: Record<string, string>;
}

export interface EncryptedRule {
  ruleId: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  detectionPattern?: string; // Regex pattern to match
  configCheck?: string;       // Config key to verify
  requiredForStacks: string[];
}

// ============================================================
// SERVER-SIDE: Encrypt a rule pack (run this on YOUR server only)
// ============================================================

export function encryptRulePack(
  rulePack: RulePack,
  licenseKey: string,
  machineId: string
): Buffer {
  const key = deriveKey(licenseKey, machineId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const plaintext = JSON.stringify(rulePack);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: [IV (16 bytes)] [Auth Tag (16 bytes)] [Encrypted Data]
  return Buffer.concat([iv, authTag, encrypted]);
}

// ============================================================
// CLIENT-SIDE: Decrypt a rule pack (runs on the enterprise user's machine)
// ============================================================

export function decryptRulePack(
  encryptedData: Buffer,
  licenseKey: string,
  machineId: string
): RulePack {
  const key = deriveKey(licenseKey, machineId);

  // Unpack: [IV (16 bytes)] [Auth Tag (16 bytes)] [Encrypted Data]
  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted: string;
  try {
    decrypted = decipher.update(encrypted).toString("utf-8") + decipher.final("utf-8");
  } catch (error) {
    throw new Error(
      "Failed to decrypt rule pack. This can mean:\n" +
      "  1. Invalid license key\n" +
      "  2. Rule pack was issued for a different machine\n" +
      "  3. Rule pack file is corrupted\n" +
      "  Contact support at support@prodguard.dev"
    );
  }

  const rulePack: RulePack = JSON.parse(decrypted);

  // Check expiry
  if (new Date(rulePack.expiresAt) < new Date()) {
    throw new Error(
      `Rule pack expired on ${rulePack.expiresAt}.\n` +
      "  Renew your license at https://prodguard.dev/renew\n" +
      "  A new rule pack will be downloaded automatically."
    );
  }

  return rulePack;
}

// ============================================================
// LICENSE MANAGER — Handles activation, storage, and rule pack download
// ============================================================

export class LicenseManager {
  private configDir: string;
  private rulePackPath: string;
  private licenseKey: string;
  private machineId: string;

  constructor(licenseKey?: string) {
    this.configDir = path.join(os.homedir(), ".prodguard");
    this.rulePackPath = path.join(this.configDir, "rules.yrp");
    this.licenseKey = licenseKey || process.env.PRODGUARD_LICENSE_KEY || "";
    this.machineId = getMachineId();

    // Ensure config directory exists
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Activate license — downloads and stores encrypted rule pack
   */
  async activate(apiUrl: string): Promise<{ success: boolean; message: string }> {
    if (!this.licenseKey) {
      return { success: false, message: "No license key provided. Set PRODGUARD_LICENSE_KEY." };
    }

    try {
      const response = await fetch(`${apiUrl}/v1/enterprise/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: this.licenseKey,
          machineId: this.machineId,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Unknown error" }));
        return { success: false, message: `Activation failed: ${error.message}` };
      }

      // Server returns the encrypted rule pack as binary
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(this.rulePackPath, buffer, { mode: 0o600 });

      return { success: true, message: "License activated. Rule pack downloaded." };
    } catch (error) {
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }
  }

  /**
   * Load and decrypt the rule pack — returns rules IN MEMORY only
   */
  loadRulePack(): RulePack | null {
    if (!fs.existsSync(this.rulePackPath)) {
      return null;
    }

    try {
      const encrypted = fs.readFileSync(this.rulePackPath);
      return decryptRulePack(encrypted, this.licenseKey, this.machineId);
    } catch (error) {
      console.error(`Rule pack error: ${error instanceof Error ? error.message : "Unknown"}`);
      return null;
    }
  }

  /**
   * Check if we have a valid (non-expired) rule pack
   */
  isActivated(): boolean {
    const rulePack = this.loadRulePack();
    return rulePack !== null;
  }

  /**
   * Get license info
   */
  getInfo(): { activated: boolean; expiresAt?: string; tier?: string; machineId: string } {
    const rulePack = this.loadRulePack();
    return {
      activated: rulePack !== null,
      expiresAt: rulePack?.expiresAt,
      tier: rulePack?.licenseTier,
      machineId: this.machineId,
    };
  }
}
