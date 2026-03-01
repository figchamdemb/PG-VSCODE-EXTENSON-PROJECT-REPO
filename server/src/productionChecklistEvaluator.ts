/**
 * Production Checklist Evaluator
 * Private framework policy vault — production readiness gate.
 *
 * Orchestrates all policy domain evaluations into a single aggregate
 * pass / blocked result.  Each domain is invoked server-side using the
 * plan-aware threshold resolver; findings are merged into one report.
 *
 * The evaluator is intentionally stateless — callers supply the payload,
 * the engine returns the aggregate.
 */

import type { PolicyDomain } from "./policyVaultTypes";

// ── Request / Response types ────────────────────────────────────────────

/** Per-domain payload supplied by the caller.  The key is a policy domain
 *  and the value is the raw request body that domain evaluator expects. */
export interface ProductionChecklistRequest {
  /** Per-domain payloads.  Omitted domains are skipped. */
  domains: Partial<Record<PolicyDomain, Record<string, unknown>>>;
  /** Framework hint (nextjs, nestjs, react, spring, etc.). */
  framework?: string;
  /** When true, report includes per-domain detail breakdown. */
  verbose?: boolean;
}

export interface ChecklistDomainResult {
  domain: PolicyDomain;
  status: "pass" | "blocked" | "error" | "skipped";
  blockers: number;
  warnings: number;
  /** Opaque summary message (no rule bodies). */
  message: string;
  /** Evaluation duration in milliseconds. */
  duration_ms: number;
}

export interface ProductionChecklistResult {
  ok: boolean;
  status: "pass" | "blocked";
  /** Total blocker count across all domains. */
  total_blockers: number;
  /** Total warning count across all domains. */
  total_warnings: number;
  /** Number of domains evaluated (excluding skipped). */
  domains_evaluated: number;
  /** Number of domains that passed. */
  domains_passed: number;
  /** Per-domain breakdown. */
  domains: ChecklistDomainResult[];
  /** Aggregate evaluation duration in milliseconds. */
  total_duration_ms: number;
  evaluated_at: string;
}

// ── Domain evaluator interface ──────────────────────────────────────────

/** Each domain evaluator conforms to this signature.
 *  Evaluators are injected by route registration — the engine does not
 *  import them directly to keep coupling loose. */
export type DomainEvaluatorFn = (
  payload: Record<string, unknown>,
  thresholds: Record<string, unknown>
) => { status?: string; blockers?: number; warnings?: number; summary?: Record<string, unknown> };

export interface DomainEvaluatorEntry {
  domain: PolicyDomain;
  evaluate: DomainEvaluatorFn;
  resolveThresholds: (plan: string, overlay: unknown) => Record<string, unknown>;
}

// ── Evaluator ───────────────────────────────────────────────────────────

export function evaluateProductionChecklist(
  request: ProductionChecklistRequest,
  evaluators: DomainEvaluatorEntry[],
  plan: string,
  overlay: unknown
): ProductionChecklistResult {
  const startAll = Date.now();
  const domainResults: ChecklistDomainResult[] = [];

  for (const entry of evaluators) {
    const payload = request.domains[entry.domain];
    if (!payload) {
      domainResults.push({
        domain: entry.domain,
        status: "skipped",
        blockers: 0,
        warnings: 0,
        message: "No payload supplied — skipped.",
        duration_ms: 0
      });
      continue;
    }

    const start = Date.now();
    try {
      const thresholds = entry.resolveThresholds(plan, overlay);
      const result = entry.evaluate(payload, thresholds);
      const blockers = result.blockers ?? (result.summary as Record<string, number>)?.blockers ?? 0;
      const warnings = result.warnings ?? (result.summary as Record<string, number>)?.warnings ?? 0;
      const status = (result.status === "blocked" || blockers > 0) ? "blocked" : "pass";

      domainResults.push({
        domain: entry.domain,
        status,
        blockers,
        warnings,
        message: status === "pass"
          ? `${entry.domain}: all checks passed.`
          : `${entry.domain}: ${blockers} blocker(s), ${warnings} warning(s).`,
        duration_ms: Date.now() - start
      });
    } catch (err) {
      domainResults.push({
        domain: entry.domain,
        status: "error",
        blockers: 0,
        warnings: 0,
        message: `${entry.domain}: evaluation error — ${err instanceof Error ? err.message : String(err)}`,
        duration_ms: Date.now() - start
      });
    }
  }

  const totalBlockers = domainResults.reduce((s, d) => s + d.blockers, 0);
  const totalWarnings = domainResults.reduce((s, d) => s + d.warnings, 0);
  const evaluated = domainResults.filter((d) => d.status !== "skipped");
  const passed = evaluated.filter((d) => d.status === "pass");

  return {
    ok: totalBlockers === 0,
    status: totalBlockers === 0 ? "pass" : "blocked",
    total_blockers: totalBlockers,
    total_warnings: totalWarnings,
    domains_evaluated: evaluated.length,
    domains_passed: passed.length,
    domains: domainResults,
    total_duration_ms: Date.now() - startAll,
    evaluated_at: new Date().toISOString()
  };
}
