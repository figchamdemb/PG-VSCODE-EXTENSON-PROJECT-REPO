import {
  decryptSecretEnvelope,
  encryptSecretEnvelope,
  isSecretEnvelope,
  SecretEnvelope
} from "./secretEnvelopeCrypto";
import { defaultPricingCatalogRaw, parsePricingCatalogRaw } from "./pricingCatalog";
import type { StripeRuntimeConfigUpdateInput } from "./stripeRuntimeManager";

export type StripeRuntimeSecretPayload = {
  stripe_secret_key: string;
  stripe_webhook_secret: string;
  stripe_publishable_key: string;
};

export type StripeRuntimeConfigRecord = StripeRuntimeSecretPayload & {
  stripe_price_map_raw: string;
  pricing_catalog_raw: string;
  checkout_success_url: string;
  checkout_cancel_url: string;
  updated_at: string;
  updated_by: string | null;
};

export type StripeRuntimeConfigFileRecord = Omit<StripeRuntimeConfigRecord, keyof StripeRuntimeSecretPayload> &
  Partial<StripeRuntimeSecretPayload> & {
    encrypted_secrets?: SecretEnvelope | null;
  };

export type LoadedStripeRuntimeConfig = {
  record: StripeRuntimeConfigRecord;
  storageMode: StripeRuntimeStorageMode;
  shouldPersistNormalizedCopy: boolean;
  writeLegacyPlaintextSecrets: boolean;
};

export type StripeRuntimeStorageMode = "encrypted-file" | "env-only" | "legacy-plaintext-file";

export function normalizeRecord(input: StripeRuntimeConfigRecord): StripeRuntimeConfigRecord {
  return {
    stripe_secret_key: String(input.stripe_secret_key ?? "").trim(),
    stripe_webhook_secret: String(input.stripe_webhook_secret ?? "").trim(),
    stripe_publishable_key: String(input.stripe_publishable_key ?? "").trim(),
    stripe_price_map_raw: normalizePriceMapRaw(String(input.stripe_price_map_raw ?? "")),
    pricing_catalog_raw: normalizePricingCatalogRaw(String(input.pricing_catalog_raw ?? "")),
    checkout_success_url: validateOptionalUrl(String(input.checkout_success_url ?? "")),
    checkout_cancel_url: validateOptionalUrl(String(input.checkout_cancel_url ?? "")),
    updated_at: input.updated_at || new Date().toISOString(),
    updated_by: input.updated_by ?? null
  };
}

export function buildPersistedRecord(
  record: StripeRuntimeConfigRecord,
  encryptionKey: string,
  writeLegacyPlaintextSecrets: boolean
): StripeRuntimeConfigFileRecord {
  const base: StripeRuntimeConfigFileRecord = {
    stripe_price_map_raw: record.stripe_price_map_raw,
    pricing_catalog_raw: record.pricing_catalog_raw,
    checkout_success_url: record.checkout_success_url,
    checkout_cancel_url: record.checkout_cancel_url,
    updated_at: record.updated_at,
    updated_by: record.updated_by
  };
  const secrets = extractSecretPayload(record);
  if (hasSecretPayloadValues(secrets) && encryptionKey) {
    base.encrypted_secrets = encryptSecretEnvelope(secrets, encryptionKey);
    return base;
  }
  if (hasSecretPayloadValues(secrets) && writeLegacyPlaintextSecrets) {
    return { ...base, ...secrets };
  }
  return base;
}

export function loadPersistedConfig(
  input: Partial<StripeRuntimeConfigFileRecord>,
  fallback: StripeRuntimeConfigRecord,
  encryptionKey: string
): LoadedStripeRuntimeConfig {
  const base = buildBaseRecord(input, fallback);
  const plaintextSecrets = extractPlaintextSecretPayload(input);
  const hasPlaintextSecrets = hasSecretPayloadValues(plaintextSecrets);
  const hasEncryptedSecretsField = Object.prototype.hasOwnProperty.call(input, "encrypted_secrets");

  if (hasEncryptedSecretsField && input.encrypted_secrets != null && !isSecretEnvelope(input.encrypted_secrets)) {
    throw new Error("Stripe runtime config encrypted_secrets payload is invalid.");
  }

  if (isSecretEnvelope(input.encrypted_secrets)) {
    if (!encryptionKey) {
      throw new Error(
        "Stripe runtime config contains encrypted secrets but STRIPE_RUNTIME_VAULT_KEY is missing."
      );
    }
    const decrypted = decryptSecretEnvelope<StripeRuntimeSecretPayload>(
      input.encrypted_secrets,
      encryptionKey
    );
    return {
      record: normalizeRecord({ ...base, ...decrypted }),
      storageMode: "encrypted-file",
      shouldPersistNormalizedCopy: hasPlaintextSecrets,
      writeLegacyPlaintextSecrets: false
    };
  }

  if (hasPlaintextSecrets) {
    return {
      record: normalizeRecord({ ...base, ...plaintextSecrets }),
      storageMode: encryptionKey ? "encrypted-file" : "legacy-plaintext-file",
      shouldPersistNormalizedCopy: Boolean(encryptionKey),
      writeLegacyPlaintextSecrets: !encryptionKey
    };
  }

  return {
    record: base,
    storageMode: encryptionKey ? "encrypted-file" : "env-only",
    shouldPersistNormalizedCopy: false,
    writeLegacyPlaintextSecrets: false
  };
}

export function hasSecretInput(input: StripeRuntimeConfigUpdateInput): boolean {
  return (
    typeof input.stripe_secret_key === "string" ||
    typeof input.stripe_webhook_secret === "string" ||
    typeof input.stripe_publishable_key === "string"
  );
}

export function describeStorageMode(mode: StripeRuntimeStorageMode): string {
  if (mode === "encrypted-file") {
    return "Stripe secrets persist encrypted at rest using STRIPE_RUNTIME_VAULT_KEY.";
  }
  if (mode === "legacy-plaintext-file") {
    return "Legacy plaintext Stripe secrets are still present in the runtime file. Set STRIPE_RUNTIME_VAULT_KEY and resave to migrate them.";
  }
  return "Stripe secrets are env/vault-managed only and are not written to disk.";
}

export function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}

function buildBaseRecord(
  input: Partial<StripeRuntimeConfigFileRecord>,
  fallback: StripeRuntimeConfigRecord
): StripeRuntimeConfigRecord {
  return normalizeRecord({
    ...fallback,
    stripe_secret_key: fallback.stripe_secret_key,
    stripe_webhook_secret: fallback.stripe_webhook_secret,
    stripe_publishable_key: fallback.stripe_publishable_key,
    stripe_price_map_raw: input.stripe_price_map_raw ?? fallback.stripe_price_map_raw,
    pricing_catalog_raw: input.pricing_catalog_raw ?? fallback.pricing_catalog_raw,
    checkout_success_url: input.checkout_success_url ?? fallback.checkout_success_url,
    checkout_cancel_url: input.checkout_cancel_url ?? fallback.checkout_cancel_url,
    updated_at: input.updated_at ?? fallback.updated_at,
    updated_by: input.updated_by ?? fallback.updated_by
  });
}

function extractPlaintextSecretPayload(
  input: Partial<StripeRuntimeConfigFileRecord>
): StripeRuntimeSecretPayload {
  return {
    stripe_secret_key: String(input.stripe_secret_key ?? "").trim(),
    stripe_webhook_secret: String(input.stripe_webhook_secret ?? "").trim(),
    stripe_publishable_key: String(input.stripe_publishable_key ?? "").trim()
  };
}

function extractSecretPayload(input: StripeRuntimeConfigRecord): StripeRuntimeSecretPayload {
  return {
    stripe_secret_key: input.stripe_secret_key,
    stripe_webhook_secret: input.stripe_webhook_secret,
    stripe_publishable_key: input.stripe_publishable_key
  };
}

function hasSecretPayloadValues(payload: StripeRuntimeSecretPayload): boolean {
  return Boolean(payload.stripe_secret_key || payload.stripe_webhook_secret || payload.stripe_publishable_key);
}

export function normalizePriceMapRaw(raw: string): string {
  const value = raw.trim();
  return value || "{}";
}

export function normalizePricingCatalogRaw(raw: string): string {
  const catalog = parsePricingCatalogRaw(raw.trim() ? raw : defaultPricingCatalogRaw());
  return JSON.stringify(catalog, null, 2);
}

export function validateOptionalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("checkout URLs must use http or https.");
  }
  return trimmed;
}