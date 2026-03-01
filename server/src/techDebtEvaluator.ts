/**
 * Tech Debt Evaluator
 * Maps policy rule findings to estimated remediation cost.
 *
 * Model: each rule finding has a severity → default hours estimate.
 * Hourly rate is plan-aware (configurable via overlay).
 * Output is a manager-ready cost summary per domain.
 */

import type { PolicyDomain } from "./policyVaultTypes";

// ── Types ───────────────────────────────────────────────────────────────

export interface TechDebtFinding {
  domain: PolicyDomain;
  rule_id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description?: string;
}

export interface TechDebtCostConfig {
  hourly_rate: number;
  currency: string;
  hours_by_severity: Record<"critical" | "warning" | "info", number>;
}

export interface TechDebtDomainSummary {
  domain: PolicyDomain;
  finding_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  estimated_hours: number;
  estimated_cost: number;
  top_findings: TechDebtFinding[];
}

export interface TechDebtResult {
  ok: true;
  status: "healthy" | "attention" | "critical";
  total_findings: number;
  total_estimated_hours: number;
  total_estimated_cost: number;
  currency: string;
  hourly_rate: number;
  domains: TechDebtDomainSummary[];
  evaluated_at: string;
}

export interface TechDebtRequest {
  findings: TechDebtFinding[];
  config?: Partial<TechDebtCostConfig>;
}

// ── Default cost model ──────────────────────────────────────────────────

const DEFAULT_COST: TechDebtCostConfig = {
  hourly_rate: 85,
  currency: "USD",
  hours_by_severity: {
    critical: 8,
    warning: 3,
    info: 0.5
  }
};

// ── Plan-aware rate adjustment ──────────────────────────────────────────

const RATE_MULTIPLIER: Record<string, number> = {
  free: 1.0,
  trial: 1.0,
  pro: 1.0,
  team: 0.95,
  enterprise: 0.9
};

// ── Evaluator ───────────────────────────────────────────────────────────

export function evaluateTechDebt(
  request: TechDebtRequest,
  plan: string
): TechDebtResult {
  const config: TechDebtCostConfig = {
    ...DEFAULT_COST,
    ...request.config,
    hours_by_severity: {
      ...DEFAULT_COST.hours_by_severity,
      ...request.config?.hours_by_severity
    }
  };

  const multiplier = RATE_MULTIPLIER[plan] ?? 1.0;
  const effectiveRate = config.hourly_rate * multiplier;
  const findings = request.findings ?? [];

  // Group by domain
  const byDomain = new Map<PolicyDomain, TechDebtFinding[]>();
  for (const f of findings) {
    const list = byDomain.get(f.domain) ?? [];
    list.push(f);
    byDomain.set(f.domain, list);
  }

  const domains: TechDebtDomainSummary[] = [];
  let totalHours = 0;
  let totalCost = 0;

  for (const [domain, domainFindings] of byDomain) {
    let critical = 0;
    let warning = 0;
    let info = 0;
    let hours = 0;

    for (const f of domainFindings) {
      switch (f.severity) {
        case "critical":
          critical++;
          hours += config.hours_by_severity.critical;
          break;
        case "warning":
          warning++;
          hours += config.hours_by_severity.warning;
          break;
        case "info":
          info++;
          hours += config.hours_by_severity.info;
          break;
      }
    }

    const cost = Math.round(hours * effectiveRate * 100) / 100;
    totalHours += hours;
    totalCost += cost;

    domains.push({
      domain,
      finding_count: domainFindings.length,
      critical_count: critical,
      warning_count: warning,
      info_count: info,
      estimated_hours: Math.round(hours * 10) / 10,
      estimated_cost: cost,
      top_findings: domainFindings
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
        .slice(0, 5)
    });
  }

  // Sort domains by cost descending
  domains.sort((a, b) => b.estimated_cost - a.estimated_cost);

  const status: "healthy" | "attention" | "critical" =
    findings.some((f) => f.severity === "critical")
      ? "critical"
      : findings.some((f) => f.severity === "warning")
        ? "attention"
        : "healthy";

  return {
    ok: true,
    status,
    total_findings: findings.length,
    total_estimated_hours: Math.round(totalHours * 10) / 10,
    total_estimated_cost: Math.round(totalCost * 100) / 100,
    currency: config.currency,
    hourly_rate: effectiveRate,
    domains,
    evaluated_at: new Date().toISOString()
  };
}

function severityRank(s: "critical" | "warning" | "info"): number {
  return s === "critical" ? 0 : s === "warning" ? 1 : 2;
}
