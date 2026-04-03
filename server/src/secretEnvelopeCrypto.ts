import * as crypto from "crypto";

export type SecretEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  salt: string;
  iv: string;
  auth_tag: string;
  ciphertext: string;
};

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const KEY_DERIVATION_LABEL = "pg-stripe-runtime-secrets:v1";

export function encryptSecretEnvelope(payload: unknown, passphrase: string): SecretEnvelope {
  const secret = normalizePassphrase(passphrase);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(secret, salt);
  const cipher = crypto.createCipheriv(ENVELOPE_ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    version: ENVELOPE_VERSION,
    algorithm: ENVELOPE_ALGORITHM,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

export function decryptSecretEnvelope<T>(envelope: SecretEnvelope, passphrase: string): T {
  if (!isSecretEnvelope(envelope)) {
    throw new Error("Encrypted secret payload is invalid.");
  }

  const secret = normalizePassphrase(passphrase);
  const salt = Buffer.from(envelope.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const authTag = Buffer.from(envelope.auth_tag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv(ENVELOPE_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = "";
  try {
    plaintext = decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
  } catch {
    throw new Error("Failed to decrypt Stripe runtime secrets. Check STRIPE_RUNTIME_VAULT_KEY.");
  }

  return JSON.parse(plaintext) as T;
}

export function isSecretEnvelope(value: unknown): value is SecretEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === ENVELOPE_VERSION &&
    candidate.algorithm === ENVELOPE_ALGORITHM &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.auth_tag === "string" &&
    typeof candidate.ciphertext === "string"
  );
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, `${KEY_DERIVATION_LABEL}:${salt.toString("hex")}`, KEY_LENGTH);
}

function normalizePassphrase(passphrase: string): string {
  const value = String(passphrase ?? "").trim();
  if (!value) {
    throw new Error("STRIPE_RUNTIME_VAULT_KEY is required for encrypted Stripe secret storage.");
  }
  return value;
}