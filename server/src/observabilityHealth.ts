type VerificationSeverity = "blocker" | "warning";

type ObservabilityAdapter = "otlp" | "sentry" | "signoz";

type ObservabilityDeploymentProfile = "pg-hosted" | "customer-hosted" | "hybrid";

type AdapterHostedBy = "pg" | "customer" | "unknown";

export interface ObservabilityHealthRuntimeInput {
  source?: string | null;
  session_id?: string | null;
}

export interface ObservabilityAdapterEvidenceInput {
  adapter?: ObservabilityAdapter | string | null;
  enabled?: boolean | null;
  endpoint_url?: string | null;
  ingest_token_present?: boolean | null;
  hosted_by?: AdapterHostedBy | string | null;
}

export interface ObservabilityHealthRequest {
  runtime?: ObservabilityHealthRuntimeInput | null;
  deployment_profile?: ObservabilityDeploymentProfile | string | null;
  adapters?: ObservabilityAdapterEvidenceInput[] | null;
}

interface ObservabilityAdapterState {
  adapter: ObservabilityAdapter;
  enabled: boolean;
  endpoint_url: string | null;
  ingest_token_present: boolean | null;
  hosted_by: AdapterHostedBy;
  readiness: "disabled" | "ready" | "misconfigured";
}

export interface ObservabilityHealthFinding {
  rule_id: string;
  severity: VerificationSeverity;
  adapter: ObservabilityAdapter | "global";
  source: "config" | "request";
  message: string;
  hint: string;
}

export interface ObservabilityHealthResult {
  ok: boolean;
  status: "pass" | "blocked";
  evaluator_version: "observability-health-v1";
  summary: {
    deployment_profile: ObservabilityDeploymentProfile;
    adapters_checked: number;
    enabled_adapters: number;
    ready_adapters: number;
    blockers: number;
    warnings: number;
    source: string;
    evaluated_at: string;
  };
  adapters: ObservabilityAdapterState[];
  findings: ObservabilityHealthFinding[];
}

const ADAPTERS: ObservabilityAdapter[] = ["otlp", "sentry", "signoz"];

export function evaluateObservabilityHealth(requestBody: ObservabilityHealthRequest): ObservabilityHealthResult {
  const source = normalizeSource(requestBody.runtime?.source);
  const deploymentProfile = resolveDeploymentProfile(requestBody.deployment_profile);
  const requestMap = buildRequestAdapterMap(requestBody.adapters);

  const adapters = ADAPTERS.map((adapter) => resolveAdapter(adapter, requestMap.get(adapter) ?? null));
  const findings: ObservabilityHealthFinding[] = [];

  applyGlobalProfileChecks(findings, deploymentProfile, adapters);
  for (const adapter of adapters) {
    applyAdapterChecks(findings, deploymentProfile, adapter);
  }

  const blockers = countBySeverity(findings, "blocker");
  const warnings = countBySeverity(findings, "warning");
  const enabledAdapters = adapters.filter((item) => item.enabled).length;
  const readyAdapters = adapters.filter((item) => item.readiness === "ready").length;
  const status: "pass" | "blocked" = blockers > 0 ? "blocked" : "pass";

  return {
    ok: status === "pass",
    status,
    evaluator_version: "observability-health-v1",
    summary: {
      deployment_profile: deploymentProfile,
      adapters_checked: adapters.length,
      enabled_adapters: enabledAdapters,
      ready_adapters: readyAdapters,
      blockers,
      warnings,
      source,
      evaluated_at: new Date().toISOString()
    },
    adapters,
    findings
  };
}

function buildRequestAdapterMap(
  adapters: ObservabilityHealthRequest["adapters"]
): Map<ObservabilityAdapter, ObservabilityAdapterEvidenceInput> {
  const map = new Map<ObservabilityAdapter, ObservabilityAdapterEvidenceInput>();
  if (!adapters || adapters.length === 0) {
    return map;
  }
  for (const adapter of adapters) {
    const key = normalizeAdapter(adapter?.adapter);
    if (!key) {
      continue;
    }
    map.set(key, adapter);
  }
  return map;
}

function resolveAdapter(
  adapter: ObservabilityAdapter,
  input: ObservabilityAdapterEvidenceInput | null
): ObservabilityAdapterState {
  const envDefaults = resolveEnvDefaults(adapter);
  const enabled = input?.enabled ?? envDefaults.enabled;
  const endpoint = normalizeEndpoint(input?.endpoint_url ?? envDefaults.endpoint_url);
  const tokenPresent = normalizeNullableBool(input?.ingest_token_present ?? envDefaults.ingest_token_present);
  const hostedBy = normalizeHostedBy(input?.hosted_by ?? envDefaults.hosted_by);
  const readiness = resolveReadiness(enabled, endpoint);
  return {
    adapter,
    enabled,
    endpoint_url: endpoint,
    ingest_token_present: tokenPresent,
    hosted_by: hostedBy,
    readiness
  };
}

function resolveEnvDefaults(adapter: ObservabilityAdapter): {
  enabled: boolean;
  endpoint_url: string | null;
  ingest_token_present: boolean | null;
  hosted_by: AdapterHostedBy;
} {
  if (adapter === "otlp") {
    return {
      enabled: parseBooleanEnv(process.env.OBSERVABILITY_OTLP_ENABLED, false),
      endpoint_url: normalizeEndpoint(process.env.OBSERVABILITY_OTLP_ENDPOINT),
      ingest_token_present: resolveTokenPresence(process.env.OBSERVABILITY_OTLP_TOKEN),
      hosted_by: normalizeHostedBy(process.env.OBSERVABILITY_OTLP_HOSTED_BY)
    };
  }
  if (adapter === "sentry") {
    const endpoint = process.env.OBSERVABILITY_SENTRY_ENDPOINT ?? process.env.SENTRY_DSN ?? "";
    const token = process.env.OBSERVABILITY_SENTRY_TOKEN ?? process.env.SENTRY_AUTH_TOKEN ?? "";
    return {
      enabled: parseBooleanEnv(process.env.OBSERVABILITY_SENTRY_ENABLED, false),
      endpoint_url: normalizeEndpoint(endpoint),
      ingest_token_present: resolveTokenPresence(token),
      hosted_by: normalizeHostedBy(process.env.OBSERVABILITY_SENTRY_HOSTED_BY)
    };
  }
  return {
    enabled: parseBooleanEnv(process.env.OBSERVABILITY_SIGNOZ_ENABLED, false),
    endpoint_url: normalizeEndpoint(
      process.env.OBSERVABILITY_SIGNOZ_ENDPOINT ?? process.env.SIGNOZ_INGEST_ENDPOINT ?? ""
    ),
    ingest_token_present: resolveTokenPresence(
      process.env.OBSERVABILITY_SIGNOZ_TOKEN ?? process.env.SIGNOZ_INGEST_TOKEN ?? ""
    ),
    hosted_by: normalizeHostedBy(process.env.OBSERVABILITY_SIGNOZ_HOSTED_BY)
  };
}

function applyGlobalProfileChecks(
  findings: ObservabilityHealthFinding[],
  deploymentProfile: ObservabilityDeploymentProfile,
  adapters: ObservabilityAdapterState[]
): void {
  const enabled = adapters.filter((item) => item.enabled);
  if (enabled.length === 0) {
    findings.push({
      rule_id: "OBS-GLOBAL-001",
      severity: "blocker",
      adapter: "global",
      source: "config",
      message: "No observability adapter is enabled.",
      hint: "Enable at least one adapter (OTLP, Sentry, or SigNoz) before production readiness checks."
    });
    return;
  }

  if (deploymentProfile === "pg-hosted") {
    const hasPgHosted = enabled.some((item) => item.hosted_by === "pg");
    if (!hasPgHosted) {
      findings.push({
        rule_id: "OBS-GLOBAL-002",
        severity: "warning",
        adapter: "global",
        source: "config",
        message: "Deployment profile is pg-hosted but no enabled adapter is marked as hosted_by=pg.",
        hint: "Set hosted_by=pg for your default managed adapter or use deployment_profile=hybrid/customer-hosted."
      });
    }
  }

  if (deploymentProfile === "customer-hosted") {
    const hasCustomerHosted = enabled.some((item) => item.hosted_by === "customer");
    if (!hasCustomerHosted) {
      findings.push({
        rule_id: "OBS-GLOBAL-003",
        severity: "warning",
        adapter: "global",
        source: "config",
        message:
          "Deployment profile is customer-hosted but no enabled adapter is marked as hosted_by=customer.",
        hint: "Mark adapter ownership as customer for BYOC/on-prem enterprise deployments."
      });
    }
  }
}

function applyAdapterChecks(
  findings: ObservabilityHealthFinding[],
  deploymentProfile: ObservabilityDeploymentProfile,
  adapter: ObservabilityAdapterState
): void {
  if (!adapter.enabled) {
    return;
  }

  if (!adapter.endpoint_url) {
    findings.push({
      rule_id: "OBS-ADAPTER-001",
      severity: "blocker",
      adapter: adapter.adapter,
      source: "config",
      message: `${adapter.adapter} adapter is enabled but endpoint URL is missing.`,
      hint: "Set the adapter endpoint URL in request payload or environment configuration."
    });
    return;
  }

  if (!isHttpEndpoint(adapter.endpoint_url)) {
    findings.push({
      rule_id: "OBS-ADAPTER-002",
      severity: "blocker",
      adapter: adapter.adapter,
      source: "config",
      message: `${adapter.adapter} endpoint URL is invalid.`,
      hint: "Use a valid absolute HTTP(S) endpoint URL."
    });
  }
  else if (adapter.endpoint_url.startsWith("http://") && !isLocalEndpoint(adapter.endpoint_url)) {
    findings.push({
      rule_id: "OBS-ADAPTER-003",
      severity: "warning",
      adapter: adapter.adapter,
      source: "config",
      message: `${adapter.adapter} endpoint is using plain HTTP over a non-local address.`,
      hint: "Use HTTPS for managed and enterprise remote observability endpoints."
    });
  }

  if (adapter.adapter !== "sentry" && adapter.ingest_token_present === false) {
    findings.push({
      rule_id: "OBS-ADAPTER-004",
      severity: "warning",
      adapter: adapter.adapter,
      source: "config",
      message: `${adapter.adapter} adapter has no ingest token evidence.`,
      hint: "Set adapter ingest token for authenticated writes or confirm mTLS/private-network enforcement."
    });
  }

  if (adapter.hosted_by === "unknown") {
    findings.push({
      rule_id: "OBS-ADAPTER-005",
      severity: "warning",
      adapter: adapter.adapter,
      source: "request",
      message: `${adapter.adapter} adapter ownership is unknown.`,
      hint: "Set hosted_by=pg for default managed mode or hosted_by=customer for BYOC/on-prem mode."
    });
  }

  if (deploymentProfile === "pg-hosted" && adapter.hosted_by === "customer") {
    findings.push({
      rule_id: "OBS-ADAPTER-006",
      severity: "warning",
      adapter: adapter.adapter,
      source: "request",
      message: `${adapter.adapter} is marked customer-hosted while deployment profile is pg-hosted.`,
      hint: "Use hybrid profile when mixing PG-hosted defaults with enterprise-owned endpoints."
    });
  }

  if (deploymentProfile === "customer-hosted" && adapter.hosted_by === "pg") {
    findings.push({
      rule_id: "OBS-ADAPTER-007",
      severity: "warning",
      adapter: adapter.adapter,
      source: "request",
      message: `${adapter.adapter} is marked pg-hosted while deployment profile is customer-hosted.`,
      hint: "Use hybrid profile for split ownership or update hosted_by to customer."
    });
  }
}

function resolveReadiness(enabled: boolean, endpoint: string | null): "disabled" | "ready" | "misconfigured" {
  if (!enabled) {
    return "disabled";
  }
  if (!endpoint || !isHttpEndpoint(endpoint)) {
    return "misconfigured";
  }
  return "ready";
}

function resolveDeploymentProfile(
  value: ObservabilityHealthRequest["deployment_profile"]
): ObservabilityDeploymentProfile {
  const fromRequest = `${value ?? ""}`.trim().toLowerCase();
  const fromEnv = `${process.env.OBSERVABILITY_DEPLOYMENT_PROFILE ?? ""}`.trim().toLowerCase();
  const candidate = fromRequest || fromEnv || "pg-hosted";
  if (candidate === "customer-hosted" || candidate === "hybrid" || candidate === "pg-hosted") {
    return candidate;
  }
  return "pg-hosted";
}

function normalizeAdapter(value: ObservabilityAdapterEvidenceInput["adapter"]): ObservabilityAdapter | null {
  const normalized = `${value ?? ""}`.trim().toLowerCase();
  if (normalized === "otlp" || normalized === "sentry" || normalized === "signoz") {
    return normalized;
  }
  return null;
}

function normalizeHostedBy(value: ObservabilityAdapterEvidenceInput["hosted_by"]): AdapterHostedBy {
  const normalized = `${value ?? ""}`.trim().toLowerCase();
  if (normalized === "pg" || normalized === "customer" || normalized === "unknown") {
    return normalized;
  }
  return "unknown";
}

function normalizeSource(value: string | null | undefined): string {
  const trimmed = `${value ?? ""}`.trim();
  if (!trimmed) {
    return "unknown";
  }
  return trimmed.slice(0, 80);
}

function normalizeEndpoint(value: string | null | undefined): string | null {
  const trimmed = `${value ?? ""}`.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 512);
}

function isHttpEndpoint(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }
  catch {
    return false;
  }
}

function isLocalEndpoint(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  }
  catch {
    return false;
  }
}

function normalizeNullableBool(value: boolean | null | undefined): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value === true;
}

function resolveTokenPresence(value: string | null | undefined): boolean | null {
  const trimmed = `${value ?? ""}`.trim();
  if (!trimmed) {
    return null;
  }
  return true;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function countBySeverity(findings: ObservabilityHealthFinding[], severity: VerificationSeverity): number {
  let count = 0;
  for (const finding of findings) {
    if (finding.severity === severity) {
      count += 1;
    }
  }
  return count;
}
