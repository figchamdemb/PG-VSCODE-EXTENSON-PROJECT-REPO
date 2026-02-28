/**
 * serverUtils.ts — Pure utility / parsing / date functions
 * extracted from index.ts for COD-LIMIT-001 compliance.
 * All functions are stateless — no side effects, no store/app/prisma deps.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { ModuleScope, PaidPlanTier } from "./types";

/* ── Type exports ─────────────────────────────────────────── */

export type StoreBackend = "json" | "prisma";
export type AdminAuthMode = "key" | "db" | "hybrid";

/* ── Numeric / clamp helpers ──────────────────────────────── */

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

/* ── Boolean / string parsing ─────────────────────────────── */

export function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes" || value === "on") {
    return true;
  }
  if (value === "false" || value === "0" || value === "no" || value === "off") {
    return false;
  }
  return fallback;
}

export function parseStringAllowList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  );
}

export function parseEmailAllowList(raw: string | undefined): Set<string> {
  const emails = (raw ?? "")
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter((item): item is string => Boolean(item));
  return new Set(emails);
}

/* ── Email / admin / config normalizers ────────────────────── */

export function normalizeEmail(value: string | undefined): string | undefined {
  const lowered = value?.trim().toLowerCase();
  if (!lowered) {
    return undefined;
  }
  return lowered.includes("@") ? lowered : undefined;
}

export function normalizeAdminRoutePrefix(raw: string | undefined): string {
  const value = (raw ?? "/pg-global-admin").trim();
  if (!value) {
    return "/pg-global-admin";
  }
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.replace(/\/+$/, "") || "/pg-global-admin";
}

export function defaultAdminNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  if (!local) {
    return "PG Global Admin";
  }
  const display = local
    .split(/[._-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return display || "PG Global Admin";
}

export function normalizeHostList(list: string[] | undefined): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

/* ── Store / admin config parsers ─────────────────────────── */

export function parseStoreBackend(raw: string | undefined): StoreBackend {
  const value = (raw ?? "json").trim().toLowerCase();
  if (value === "json" || value === "prisma") {
    return value;
  }
  return "json";
}

export function parseAdminAuthMode(raw: string | undefined): AdminAuthMode {
  const value = (raw ?? "db").trim().toLowerCase();
  if (value === "key" || value === "db" || value === "hybrid") {
    return value;
  }
  return "db";
}

export function parseSuperAdminSource(raw: string | undefined): "env" | "db" | "hybrid" {
  const value = (raw ?? "db").trim().toLowerCase();
  if (value === "env" || value === "db" || value === "hybrid") {
    return value;
  }
  return "db";
}

export function parseCookieSameSite(
  raw: string | undefined,
  fallback: "strict" | "lax" | "none"
): "strict" | "lax" | "none" {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "strict" || value === "lax" || value === "none") {
    return value;
  }
  return fallback;
}

/* ── Database / Stripe helpers ────────────────────────────── */

export function describeDatabaseTarget(raw: string | undefined): string {
  if (!raw || !raw.trim()) {
    return "not-configured";
  }
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname || "unknown-host";
    const port = parsed.port || "5432";
    const dbName = parsed.pathname.replace(/^\/+/, "") || "unknown-db";
    const schema = parsed.searchParams.get("schema");
    return schema ? `${host}:${port}/${dbName}?schema=${schema}` : `${host}:${port}/${dbName}`;
  } catch {
    return "invalid-database-url";
  }
}

export function parseStripePriceMap(raw: string): Record<string, string> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        mapped[key.trim().toLowerCase()] = value.trim();
      }
    }
    return mapped;
  } catch {
    return {};
  }
}

export function parseOriginList(raw: string | undefined, fallbackOrigin: string): string[] {
  const candidates = (raw ?? fallbackOrigin)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const validOrigins = new Set<string>();
  for (const candidate of candidates) {
    try {
      const origin = new URL(candidate).origin;
      validOrigins.add(origin);
    } catch {
      // Ignore malformed origins and keep validating the rest.
    }
  }
  try {
    validOrigins.add(new URL(fallbackOrigin).origin);
  } catch {
    // Keep derived values only.
  }
  return Array.from(validOrigins);
}

export function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",").map((item) => item.trim());
  const timestamp = parts.find((item) => item.startsWith("t="))?.slice(2);
  const signatures = parts.filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");

  const hasMatch = signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "utf8");
    if (candidateBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });
  if (!hasMatch) {
    return false;
  }

  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  return ageSeconds <= 300;
}

/* ── Typed value extractors ───────────────────────────────── */

export function getObject(source: Record<string, unknown>, pathSegments: string[]): Record<string, unknown> {
  let current: unknown = source;
  for (const segment of pathSegments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return {};
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current && typeof current === "object" ? (current as Record<string, unknown>) : {};
}

export function getString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

export function getNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === "number" ? value : undefined;
}

export function asPaidPlanTier(value: string | undefined): PaidPlanTier | undefined {
  if (value === "pro" || value === "team" || value === "enterprise") {
    return value;
  }
  return undefined;
}

export function asModuleScope(value: string | undefined): ModuleScope | undefined {
  if (value === "narrate" || value === "memorybank" || value === "bundle") {
    return value;
  }
  return undefined;
}

/* ── URL / callback helpers ───────────────────────────────── */

export function isLoopbackCallbackUrl(callbackUrl: string): boolean {
  try {
    const parsed = new URL(callbackUrl);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

export function getBearerToken(raw: string | undefined): string | undefined {
  if (!raw?.startsWith("Bearer ")) {
    return undefined;
  }
  return raw.substring("Bearer ".length).trim();
}

/* ── Date helpers ─────────────────────────────────────────── */

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addYears(date: Date, years: number): Date {
  const copy = new Date(date.getTime());
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

/* ── Error / JSON helpers ─────────────────────────────────── */

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}
