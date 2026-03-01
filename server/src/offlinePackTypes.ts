/**
 * Offline Pack Types
 * Milestone 13F – Enterprise offline encrypted rule pack.
 *
 * Type definitions for the machine-bound, AES-256-GCM encrypted
 * offline policy rule packs issued exclusively to enterprise tiers.
 *
 * Contents: pack payload, activation request/response shapes,
 * metadata for admin dashboards, crypto constants.
 * No crypto logic lives here — see offlinePackCrypto.ts.
 */

import type { PlanTier } from "./types";
import type { PolicyDomain } from "./policyVaultTypes";

// ── Crypto constants ────────────────────────────────────────────────────

/** PBKDF2 iteration count for key derivation. */
export const PBKDF2_ITERATIONS = 100_000;
/** AES-256 key length in bytes. */
export const KEY_LENGTH = 32;
/** AES-GCM IV length in bytes. */
export const IV_LENGTH = 16;
/** AES-GCM authentication tag length in bytes. */
export const AUTH_TAG_LENGTH = 16;
/** Internal salt compiled into server binary — never expose. */
export const INTERNAL_SALT = "PG_v1_2026_xK9mR4nT8qW2pL5j";
/** Default offline pack TTL in days. */
export const DEFAULT_PACK_TTL_DAYS = 30;

// ── Offline rule ────────────────────────────────────────────────────────

/** Single rule inside an encrypted pack (server-private content). */
export interface OfflineRule {
  ruleId: string;
  domain: PolicyDomain;
  severity: "blocker" | "warning" | "info";
  title: string;
  description: string;
  recommendation: string;
  detectionPattern?: string;
  configCheck?: string;
  requiredForStacks?: string[];
}

// ── Offline rule pack payload (placed inside encrypted envelope) ────────

/** JSON payload encrypted inside the .yrp binary envelope. */
export interface OfflineRulePackPayload {
  /** Pack identifier (UUID). */
  pack_id: string;
  /** Semantic version of the pack content. */
  version: string;
  /** ISO-8601 date the pack was issued. */
  issued_at: string;
  /** ISO-8601 date the pack expires. */
  expires_at: string;
  /** Plan tier of the licensee (always "enterprise"). */
  plan: PlanTier;
  /** Policy domains included in this pack. */
  domains: PolicyDomain[];
  /** Per-domain version tags at time of issue. */
  domain_versions: Record<string, string>;
  /** Per-domain threshold configs (opaque to client). */
  thresholds: Record<string, Record<string, unknown>>;
  /** Per-domain scoring weights. */
  scoring_weights: Record<string, number>;
  /** Severity overrides keyed by ruleId. */
  severity_overrides: Record<string, string>;
  /** Rule bodies (server-private). */
  rules: OfflineRule[];
}

// ── Activation request / response ───────────────────────────────────────

/** Client → server activation request. */
export interface OfflinePackActivationRequest {
  license_key: string;
  machine_id: string;
}

/** Server → client activation response (binary pack in body). */
export interface OfflinePackActivationMeta {
  ok: true;
  pack_id: string;
  version: string;
  expires_at: string;
  domains: PolicyDomain[];
}

export interface OfflinePackActivationError {
  ok: false;
  error: string;
  code: "NOT_ENTERPRISE" | "INVALID_LICENSE" | "SERVER_ERROR";
}

// ── Pack metadata (admin / info endpoints) ──────────────────────────────

/** Metadata returned by the info endpoint (no rule bodies). */
export interface OfflinePackMetadata {
  pack_id: string;
  user_id: string;
  machine_id: string;
  issued_at: string;
  expires_at: string;
  version: string;
  plan: PlanTier;
  domains: PolicyDomain[];
  domain_versions: Record<string, string>;
  is_expired: boolean;
}

// ── Admin issuance ──────────────────────────────────────────────────────

/** Admin → server request to issue a pack for a specific user. */
export interface AdminOfflinePackIssueRequest {
  user_id: string;
  machine_id: string;
  ttl_days?: number;
}

/** Admin issuance response. */
export interface AdminOfflinePackIssueResponse {
  ok: true;
  meta: OfflinePackMetadata;
}
