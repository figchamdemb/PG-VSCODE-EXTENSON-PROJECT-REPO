/**
 * Offline Pack Crypto
 * Milestone 13F – Enterprise offline encrypted rule pack.
 *
 * Server-side encryption + client-side decryption for machine-bound
 * offline policy packs.  AES-256-GCM with PBKDF2-derived keys.
 *
 * Security layers:
 *  1. AES-256-GCM encryption (authenticated)
 *  2. Key derived from license_key + machine_id + internal salt
 *  3. Internal salt compiled into server binary
 *  4. Rules decrypted in-memory only — never written to disk
 *  5. Expiry timestamp inside encrypted payload (tamper-proof)
 */

import * as crypto from "crypto";
import * as os from "os";
import type { OfflineRulePackPayload } from "./offlinePackTypes";
import {
  AUTH_TAG_LENGTH,
  INTERNAL_SALT,
  IV_LENGTH,
  KEY_LENGTH,
  PBKDF2_ITERATIONS
} from "./offlinePackTypes";

// ── Machine fingerprint ─────────────────────────────────────────────────

/**
 * Build a stable machine fingerprint from hardware signals.
 * Returns a 32-hex-char SHA-256 digest.
 */
export function getMachineFingerprint(): string {
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model ?? "unknown",
    os.totalmem().toString(),
    ...Object.values(os.networkInterfaces())
      .flat()
      .filter(
        (i) => i && !i.internal && i.mac !== "00:00:00:00:00:00"
      )
      .map((i) => i!.mac)
      .slice(0, 3)
  ];
  return crypto
    .createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .substring(0, 32);
}

// ── Key derivation ──────────────────────────────────────────────────────

/**
 * Derive a 256-bit AES key via PBKDF2(SHA-512).
 * Combined material: `licenseKey:machineId:INTERNAL_SALT`.
 */
export function derivePackKey(
  licenseKey: string,
  machineId: string
): Buffer {
  const combined = `${licenseKey}:${machineId}:${INTERNAL_SALT}`;
  return crypto.pbkdf2Sync(
    combined,
    INTERNAL_SALT,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    "sha512"
  );
}

// ── Encrypt ─────────────────────────────────────────────────────────────

/**
 * Encrypt a rule-pack payload into a .yrp binary envelope.
 *
 * Format: `[IV 16 B][AuthTag 16 B][Encrypted JSON]`
 */
export function encryptOfflinePack(
  payload: OfflineRulePackPayload,
  licenseKey: string,
  machineId: string
): Buffer {
  const key = derivePackKey(licenseKey, machineId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

// ── Decrypt ─────────────────────────────────────────────────────────────

/**
 * Decrypt a .yrp binary envelope back to a rule-pack payload.
 * Validates expiry after decryption.
 *
 * @throws If key mismatch, corruption, or pack expired.
 */
export function decryptOfflinePack(
  data: Buffer,
  licenseKey: string,
  machineId: string
): OfflineRulePackPayload {
  const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1;
  if (data.length < minLength) {
    throw new Error("Encrypted pack too short — file may be corrupted.");
  }

  const key = derivePackKey(licenseKey, machineId);
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted: string;
  try {
    decrypted =
      decipher.update(encrypted).toString("utf-8") +
      decipher.final("utf-8");
  } catch {
    throw new Error(
      "Failed to decrypt rule pack. Possible causes:\n" +
        "  1. Invalid license key\n" +
        "  2. Pack issued for a different machine\n" +
        "  3. File corrupted"
    );
  }

  const payload: OfflineRulePackPayload = JSON.parse(decrypted);

  if (new Date(payload.expires_at) < new Date()) {
    throw new Error(
      `Offline rule pack expired on ${payload.expires_at}. ` +
        "Re-activate to download a fresh pack."
    );
  }

  return payload;
}

// ── Generate a secure license key ───────────────────────────────────────

/** Generate a 48-char hex license key for enterprise activation. */
export function generateLicenseKey(): string {
  return crypto.randomBytes(24).toString("hex");
}
