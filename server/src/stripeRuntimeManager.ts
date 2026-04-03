import * as fs from "fs/promises";
import * as path from "path";
import { ModuleScope, PaidPlanTier } from "./types";
import { parseStripePriceMap } from "./serverUtils";
import { parsePricingCatalogRaw, PublicPricingCatalog } from "./pricingCatalog";
import {
  buildPersistedRecord,
  describeStorageMode,
  hasSecretInput,
  isMissingFileError,
  loadPersistedConfig,
  normalizeRecord,
  normalizePriceMapRaw,
  normalizePricingCatalogRaw,
  StripeRuntimeConfigRecord,
  StripeRuntimeStorageMode,
  validateOptionalUrl
} from "./stripeRuntimeStorage";

export type StripeRuntimeConfigSnapshot = {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  priceMapRaw: string;
  priceMap: Record<string, string>;
  pricingCatalogRaw: string;
  pricingCatalog: PublicPricingCatalog;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type StripeRuntimeConfigPublicView = {
  has_secret_key: boolean;
  has_webhook_secret: boolean;
  has_publishable_key: boolean;
  secret_key_hint: string | null;
  webhook_secret_hint: string | null;
  publishable_key_hint: string | null;
  secret_storage_mode: StripeRuntimeStorageMode;
  secret_storage_note: string;
  stripe_price_map_raw: string;
  pricing_catalog_raw: string;
  checkout_success_url: string;
  checkout_cancel_url: string;
  updated_at: string;
  updated_by: string | null;
};

export type StripeRuntimeConfigUpdateInput = {
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  stripe_publishable_key?: string;
  stripe_price_map_raw?: string;
  pricing_catalog_raw?: string;
  checkout_success_url?: string;
  checkout_cancel_url?: string;
};

export type StripeRuntimeConfigTestResult = {
  ok: boolean;
  mode: "live" | "test" | "unknown";
  warnings: string[];
  errors: string[];
  details: {
    has_secret_key: boolean;
    has_webhook_secret: boolean;
    has_price_map: boolean;
    has_success_url: boolean;
    has_cancel_url: boolean;
    missing_price_keys: string[];
    stripe_http_status?: number;
  };
};

type StripeRuntimeConfigManagerOptions = {
  configPath: string;
  encryptionKey?: string;
  initial: {
    stripe_secret_key: string;
    stripe_webhook_secret: string;
    stripe_publishable_key: string;
    stripe_price_map_raw: string;
    pricing_catalog_raw: string;
    checkout_success_url: string;
    checkout_cancel_url: string;
  };
};

type StripeBalanceCheckResult =
  | { ok: true; status: number; livemode: boolean }
  | { ok: false; status?: number; error: string };

const REQUIRED_PRICE_KEYS: Array<`${PaidPlanTier}:${ModuleScope}`> = [
  "pro:narrate",
  "pro:memorybank",
  "pro:bundle",
  "team:narrate",
  "team:memorybank",
  "team:bundle",
  "enterprise:narrate",
  "enterprise:memorybank",
  "enterprise:bundle"
];

export class StripeRuntimeConfigManager {
  private readonly configPath: string;
  private readonly encryptionKey: string;
  private state: StripeRuntimeConfigRecord;
  private storageMode: StripeRuntimeStorageMode;
  private writeLegacyPlaintextSecrets = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(options: StripeRuntimeConfigManagerOptions) {
    this.configPath = options.configPath;
    this.encryptionKey = String(options.encryptionKey ?? "").trim();
    this.storageMode = this.encryptionKey ? "encrypted-file" : "env-only";
    this.state = normalizeRecord({
      ...options.initial,
      updated_at: new Date().toISOString(),
      updated_by: "env-default"
    });
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    try {
      const raw = await fs.readFile(this.configPath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const loaded = loadPersistedConfig(parsed, this.state, this.encryptionKey);
      this.state = loaded.record;
      this.storageMode = loaded.storageMode;
      this.writeLegacyPlaintextSecrets = loaded.writeLegacyPlaintextSecrets;
      if (loaded.shouldPersistNormalizedCopy) {
        await this.persist();
      }
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
      await this.persist();
    }
  }

  snapshot(): StripeRuntimeConfigSnapshot {
    const copy = { ...this.state };
    return {
      secretKey: copy.stripe_secret_key,
      webhookSecret: copy.stripe_webhook_secret,
      publishableKey: copy.stripe_publishable_key,
      priceMapRaw: copy.stripe_price_map_raw,
      priceMap: parseStripePriceMap(copy.stripe_price_map_raw),
      pricingCatalogRaw: copy.pricing_catalog_raw,
      pricingCatalog: parsePricingCatalogRaw(copy.pricing_catalog_raw),
      checkoutSuccessUrl: copy.checkout_success_url,
      checkoutCancelUrl: copy.checkout_cancel_url,
      updatedAt: copy.updated_at,
      updatedBy: copy.updated_by
    };
  }

  publicView(): StripeRuntimeConfigPublicView {
    const snap = this.snapshot();
    return {
      has_secret_key: Boolean(snap.secretKey),
      has_webhook_secret: Boolean(snap.webhookSecret),
      has_publishable_key: Boolean(snap.publishableKey),
      secret_key_hint: maskSecret(snap.secretKey),
      webhook_secret_hint: maskSecret(snap.webhookSecret),
      publishable_key_hint: maskSecret(snap.publishableKey),
      secret_storage_mode: this.storageMode,
      secret_storage_note: describeStorageMode(this.storageMode),
      stripe_price_map_raw: snap.priceMapRaw,
      pricing_catalog_raw: snap.pricingCatalogRaw,
      checkout_success_url: snap.checkoutSuccessUrl,
      checkout_cancel_url: snap.checkoutCancelUrl,
      updated_at: snap.updatedAt,
      updated_by: snap.updatedBy
    };
  }

  pricingCatalogPublic(): PublicPricingCatalog {
    return this.snapshot().pricingCatalog;
  }

  resolvePriceId(planId: PaidPlanTier, moduleScope: ModuleScope): string | undefined {
    const key = `${planId}:${moduleScope}`.toLowerCase();
    const map = parseStripePriceMap(this.state.stripe_price_map_raw);
    return map[key];
  }

  async update(input: StripeRuntimeConfigUpdateInput, updatedBy: string | null): Promise<StripeRuntimeConfigPublicView> {
    if (hasSecretInput(input) && !this.encryptionKey) {
      throw new Error(
        "Stripe secret fields can only be saved from the admin board when STRIPE_RUNTIME_VAULT_KEY is configured. " +
          "Otherwise keep test/live keys in server/.env or your deployment secret manager."
      );
    }

    const next = normalizeRecord({ ...this.state });
    if (typeof input.stripe_secret_key === "string") {
      next.stripe_secret_key = input.stripe_secret_key.trim();
    }
    if (typeof input.stripe_webhook_secret === "string") {
      next.stripe_webhook_secret = input.stripe_webhook_secret.trim();
    }
    if (typeof input.stripe_publishable_key === "string") {
      next.stripe_publishable_key = input.stripe_publishable_key.trim();
    }
    if (typeof input.stripe_price_map_raw === "string") {
      next.stripe_price_map_raw = normalizePriceMapRaw(input.stripe_price_map_raw);
      ensureValidPriceMapJson(next.stripe_price_map_raw);
    }
    if (typeof input.pricing_catalog_raw === "string") {
      next.pricing_catalog_raw = normalizePricingCatalogRaw(input.pricing_catalog_raw);
    }
    if (typeof input.checkout_success_url === "string") {
      next.checkout_success_url = validateOptionalUrl(input.checkout_success_url);
    }
    if (typeof input.checkout_cancel_url === "string") {
      next.checkout_cancel_url = validateOptionalUrl(input.checkout_cancel_url);
    }
    next.updated_at = new Date().toISOString();
    next.updated_by = updatedBy;
    if (hasSecretInput(input) && this.encryptionKey) {
      this.storageMode = "encrypted-file";
      this.writeLegacyPlaintextSecrets = false;
    }
    this.state = next;
    this.writeChain = this.writeChain.then(() => this.persist());
    await this.writeChain;
    return this.publicView();
  }

  async testConnection(): Promise<StripeRuntimeConfigTestResult> {
    const snapshot = this.snapshot();
    const warnings = collectConfigWarnings(snapshot);
    const details = buildConnectionDetails(snapshot);
    if (!snapshot.secretKey) {
      return missingSecretResult(warnings, details);
    }
    const stripeCheck = await runStripeBalanceCheck(snapshot.secretKey);
    if (!stripeCheck.ok) {
      return stripeFailureResult(warnings, details, stripeCheck);
    }
    return stripeSuccessResult(warnings, details, stripeCheck);
  }

  private async persist(): Promise<void> {
    const persisted = buildPersistedRecord(
      this.state,
      this.encryptionKey,
      this.writeLegacyPlaintextSecrets
    );
    await fs.writeFile(this.configPath, JSON.stringify(persisted, null, 2), "utf8");
  }
}

export function createStripeRuntimeConfigManager(
  options: StripeRuntimeConfigManagerOptions
): StripeRuntimeConfigManager {
  return new StripeRuntimeConfigManager(options);
}
function ensureValidPriceMapJson(raw: string): void {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("stripe_price_map_raw must be a JSON object.");
    }
  } catch {
    throw new Error("stripe_price_map_raw must be valid JSON object text.");
  }
}

function maskSecret(value: string): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 8) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function collectConfigWarnings(snapshot: StripeRuntimeConfigSnapshot): string[] {
  const warnings: string[] = [];
  const missingPriceKeys = REQUIRED_PRICE_KEYS.filter((key) => !snapshot.priceMap[key]);
  if (missingPriceKeys.length > 0) {
    warnings.push(`Missing Stripe price map keys: ${missingPriceKeys.join(", ")}`);
  }
  if (!snapshot.webhookSecret) {
    warnings.push("Stripe webhook secret is missing.");
  }
  if (!snapshot.checkoutSuccessUrl || !snapshot.checkoutCancelUrl) {
    warnings.push("Checkout success/cancel URL is missing.");
  }
  return warnings;
}

function buildConnectionDetails(snapshot: StripeRuntimeConfigSnapshot): StripeRuntimeConfigTestResult["details"] {
  return {
    has_secret_key: Boolean(snapshot.secretKey),
    has_webhook_secret: Boolean(snapshot.webhookSecret),
    has_price_map: Object.keys(snapshot.priceMap).length > 0,
    has_success_url: Boolean(snapshot.checkoutSuccessUrl),
    has_cancel_url: Boolean(snapshot.checkoutCancelUrl),
    missing_price_keys: REQUIRED_PRICE_KEYS.filter((key) => !snapshot.priceMap[key])
  };
}

function missingSecretResult(
  warnings: string[],
  details: StripeRuntimeConfigTestResult["details"]
): StripeRuntimeConfigTestResult {
  return {
    ok: false,
    mode: "unknown",
    warnings,
    errors: ["Stripe secret key is missing."],
    details
  };
}

async function runStripeBalanceCheck(secretKey: string): Promise<StripeBalanceCheckResult> {
  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      method: "GET",
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(10000)
    });
    const raw = await response.text();
    const parsed = tryParseJson(raw);
    if (!response.ok) {
      const message = extractStripeError(parsed, raw);
      return { ok: false, status: response.status, error: message };
    }
    const livemode = isStripeLiveMode(parsed);
    return { ok: true, status: response.status, livemode };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function stripeFailureResult(
  warnings: string[],
  details: StripeRuntimeConfigTestResult["details"],
  result: { ok: false; status?: number; error: string }
): StripeRuntimeConfigTestResult {
  const statusFragment = typeof result.status === "number" ? ` (${result.status})` : "";
  return {
    ok: false,
    mode: "unknown",
    warnings,
    errors: [`Stripe API check failed${statusFragment}: ${result.error}`],
    details: { ...details, stripe_http_status: result.status }
  };
}

function stripeSuccessResult(
  warnings: string[],
  details: StripeRuntimeConfigTestResult["details"],
  result: StripeBalanceCheckResult
): StripeRuntimeConfigTestResult {
  if (!result.ok) {
    return stripeFailureResult(warnings, details, result);
  }
  return {
    ok: true,
    mode: result.livemode ? "live" : "test",
    warnings,
    errors: [],
    details: { ...details, stripe_http_status: result.status }
  };
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isStripeLiveMode(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") {
    return false;
  }
  const value = (parsed as Record<string, unknown>).livemode;
  return value === true;
}

function extractStripeError(parsed: unknown, fallback: string): string {
  if (parsed && typeof parsed === "object") {
    const maybeError = (parsed as Record<string, unknown>).error;
    if (maybeError && typeof maybeError === "object" && "message" in maybeError) {
      return String((maybeError as Record<string, unknown>).message);
    }
  }
  return fallback;
}
