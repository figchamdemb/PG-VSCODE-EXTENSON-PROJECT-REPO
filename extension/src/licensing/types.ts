import { PlanTier } from "./plans";

export interface EntitlementFeatures {
  edu_view: boolean;
  export: boolean;
  change_report: boolean;
  memorybank: boolean;
}

export interface ProviderPolicy {
  local_only: boolean;
  byo_allowed: boolean;
  allowlist: string[];
  denylist: string[];
}

export interface GovernanceEntitlement {
  eod_reports: boolean;
  mastermind: boolean;
  reviewer_digest: boolean;
  decision_sync: boolean;
  slack_integration: boolean;
}

export interface ExtensionFeatureEntitlement {
  trust_score: boolean;
  dead_code_scan: boolean;
  commit_quality_gate: boolean;
  codebase_tour: boolean;
  api_contract_validator: boolean;
  environment_doctor: boolean;
}

export interface EntitlementClaims {
  sub: string;
  install_id: string;
  plan: PlanTier;
  features: EntitlementFeatures;
  modules: Array<"narrate" | "memorybank" | "bundle">;
  projects_allowed: number;
  projects_used: number;
  trial_expires_at: string | null;
  refund_window_ends_at: string | null;
  token_max_ttl_hours: number;
  provider_policy: ProviderPolicy;
  /** Governance feature flags (v2 — optional for backward compat). */
  governance?: GovernanceEntitlement;
  /** Available policy domains for the user's plan (v2). */
  policy_domains?: string[];
  /** Extension feature gates per plan (v2). */
  extension_features?: ExtensionFeatureEntitlement;
  exp: number;
  iat: number;
}

export interface AuthStartResponse {
  status: "code_sent";
  email: string;
  expires_at: string;
  dev_code?: string;
}

export interface AuthVerifyResponse {
  access_token: string;
  expires_in_sec: number;
  user_id: string;
}

export interface EntitlementTokenResponse {
  entitlement_token: string;
  expires_at: string;
}

export interface EntitlementStatusResponse {
  entitlement_token: string;
  expires_at: string;
  claims: EntitlementClaims;
}

export interface PublicKeyResponse {
  alg: "ES256" | "RS256";
  public_key_pem: string;
}

export interface ProjectQuotaResponse {
  scope: string;
  projects_allowed: number;
  projects_used: number;
  projects_remaining: number;
}

export interface ProjectActivationResponse extends ProjectQuotaResponse {
  idempotent: boolean;
}

export interface DeviceRecord {
  id: string;
  install_id: string;
  device_label: string | null;
  last_seen_at: string;
  revoked_at: string | null;
}

export interface RedeemApplyResponse {
  ok: true;
  plan_id: "pro" | "team" | "enterprise";
  module_scope: "narrate" | "memorybank" | "bundle";
  ends_at: string;
}

export interface StripeCheckoutSessionResponse {
  ok: true;
  url: string;
  session_id: string;
}
