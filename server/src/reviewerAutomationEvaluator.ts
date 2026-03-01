/**
 * Reviewer Automation Evaluator
 * Milestone 10A — Enterprise reviewer automation policy.
 *
 * Pure logic module for:
 *  - Reviewer auto-assignment (round-robin / broadcast)
 *  - SLA staleness checks per thread
 *  - Escalation target resolution
 *  - Policy status reporting
 *
 * No side effects — operates on snapshots and returns plain objects.
 */

import type {
  MastermindThreadRecord,
  ReviewerAutomationPolicyRecord,
  ReviewerAssignmentMode,
  StoreState,
} from "./types";

// ── Public types ────────────────────────────────────────────────────────

export interface ReviewerAssignment {
  thread_id: string;
  assigned_emails: string[];
  assignment_mode: ReviewerAssignmentMode;
  assigned_at: string;
}

export interface ThreadSlaStatus {
  thread_id: string;
  title: string;
  created_at: string;
  age_hours: number;
  sla_hours: number;
  breached: boolean;
  remaining_hours: number;
}

export interface EscalationTarget {
  thread_id: string;
  title: string;
  escalation_email: string;
  age_hours: number;
  sla_hours: number;
  breach_hours: number;
}

export interface PolicyStatusReport {
  scope_type: "user" | "team";
  scope_id: string;
  enabled: boolean;
  reviewer_count: number;
  required_approvals: number;
  sla_hours: number;
  assignment_mode: ReviewerAssignmentMode;
  escalation_email: string | null;
  open_threads: number;
  breached_threads: number;
  pending_assignments: number;
  evaluated_at: string;
}

export interface ReviewerPolicyInput {
  enabled?: boolean;
  reviewer_emails?: string[];
  required_approvals?: number;
  sla_hours?: number;
  escalation_email?: string | null;
  assignment_mode?: ReviewerAssignmentMode;
}

// ── Constants ───────────────────────────────────────────────────────────

const MIN_SLA_HOURS = 1;
const MAX_SLA_HOURS = 720; // 30 days
const MIN_REQUIRED_APPROVALS = 1;
const MAX_REQUIRED_APPROVALS = 10;
const MAX_REVIEWER_EMAILS = 50;
const MAX_EMAIL_LENGTH = 254;

// ── Validation ──────────────────────────────────────────────────────────

export function validateReviewerPolicyInput(
  input: ReviewerPolicyInput
): { valid: true } | { valid: false; error: string } {
  if (input.reviewer_emails !== undefined) {
    if (!Array.isArray(input.reviewer_emails)) {
      return { valid: false, error: "reviewer_emails must be an array" };
    }
    if (input.reviewer_emails.length > MAX_REVIEWER_EMAILS) {
      return { valid: false, error: `reviewer_emails max ${MAX_REVIEWER_EMAILS} entries` };
    }
    for (const email of input.reviewer_emails) {
      if (typeof email !== "string" || email.length === 0 || email.length > MAX_EMAIL_LENGTH) {
        return { valid: false, error: "each reviewer_email must be a non-empty string" };
      }
      if (!email.includes("@")) {
        return { valid: false, error: `invalid reviewer email: ${email.slice(0, 40)}` };
      }
    }
  }

  if (input.required_approvals !== undefined) {
    if (
      typeof input.required_approvals !== "number" ||
      !Number.isFinite(input.required_approvals) ||
      input.required_approvals < MIN_REQUIRED_APPROVALS ||
      input.required_approvals > MAX_REQUIRED_APPROVALS
    ) {
      return {
        valid: false,
        error: `required_approvals must be ${MIN_REQUIRED_APPROVALS}-${MAX_REQUIRED_APPROVALS}`,
      };
    }
  }

  if (input.sla_hours !== undefined) {
    if (
      typeof input.sla_hours !== "number" ||
      !Number.isFinite(input.sla_hours) ||
      input.sla_hours < MIN_SLA_HOURS ||
      input.sla_hours > MAX_SLA_HOURS
    ) {
      return { valid: false, error: `sla_hours must be ${MIN_SLA_HOURS}-${MAX_SLA_HOURS}` };
    }
  }

  if (input.assignment_mode !== undefined) {
    if (input.assignment_mode !== "round_robin" && input.assignment_mode !== "all") {
      return { valid: false, error: "assignment_mode must be round_robin or all" };
    }
  }

  if (input.escalation_email !== undefined && input.escalation_email !== null) {
    if (
      typeof input.escalation_email !== "string" ||
      input.escalation_email.length === 0 ||
      !input.escalation_email.includes("@")
    ) {
      return { valid: false, error: "escalation_email must be a valid email or null" };
    }
  }

  return { valid: true };
}

// ── Assignment logic ────────────────────────────────────────────────────

/**
 * Choose reviewers for a thread based on the policy assignment mode.
 *
 * - `all`: Returns all reviewer emails.
 * - `round_robin`: Returns the next reviewer in rotation.
 *
 * Returns the assignment and an updated `last_assigned_index` for
 * the caller to persist.
 */
export function assignReviewersForThread(
  policy: ReviewerAutomationPolicyRecord,
  threadId: string,
  nowIso: string
): { assignment: ReviewerAssignment; nextIndex: number } {
  const pool = policy.reviewer_emails;
  if (pool.length === 0) {
    return {
      assignment: {
        thread_id: threadId,
        assigned_emails: [],
        assignment_mode: policy.assignment_mode,
        assigned_at: nowIso,
      },
      nextIndex: policy.last_assigned_index,
    };
  }

  if (policy.assignment_mode === "all") {
    return {
      assignment: {
        thread_id: threadId,
        assigned_emails: [...pool],
        assignment_mode: "all",
        assigned_at: nowIso,
      },
      nextIndex: policy.last_assigned_index,
    };
  }

  // round_robin
  const idx = policy.last_assigned_index % pool.length;
  const chosen = pool[idx];
  return {
    assignment: {
      thread_id: threadId,
      assigned_emails: [chosen],
      assignment_mode: "round_robin",
      assigned_at: nowIso,
    },
    nextIndex: idx + 1,
  };
}

// ── SLA checking ────────────────────────────────────────────────────────

/**
 * Evaluate SLA status for all open threads accessible by the policy scope.
 */
export function checkThreadSla(
  policy: ReviewerAutomationPolicyRecord,
  threads: MastermindThreadRecord[],
  nowMs: number
): ThreadSlaStatus[] {
  return threads
    .filter((t) => t.status === "open")
    .map((t) => {
      const createdMs = new Date(t.created_at).getTime();
      const ageHours = Math.max(0, (nowMs - createdMs) / (1000 * 60 * 60));
      const remainingHours = Math.max(0, policy.sla_hours - ageHours);
      return {
        thread_id: t.id,
        title: t.title,
        created_at: t.created_at,
        age_hours: Math.round(ageHours * 100) / 100,
        sla_hours: policy.sla_hours,
        breached: ageHours >= policy.sla_hours,
        remaining_hours: Math.round(remainingHours * 100) / 100,
      };
    })
    .sort((a, b) => b.age_hours - a.age_hours);
}

// ── Escalation resolution ───────────────────────────────────────────────

/**
 * Build the list of threads that need escalation (SLA breached + escalation
 * email configured).
 */
export function resolveEscalationTargets(
  policy: ReviewerAutomationPolicyRecord,
  threads: MastermindThreadRecord[],
  nowMs: number
): EscalationTarget[] {
  if (!policy.escalation_email) {
    return [];
  }
  return threads
    .filter((t) => t.status === "open")
    .reduce<EscalationTarget[]>((acc, t) => {
      const createdMs = new Date(t.created_at).getTime();
      const ageHours = (nowMs - createdMs) / (1000 * 60 * 60);
      if (ageHours >= policy.sla_hours) {
        acc.push({
          thread_id: t.id,
          title: t.title,
          escalation_email: policy.escalation_email!,
          age_hours: Math.round(ageHours * 100) / 100,
          sla_hours: policy.sla_hours,
          breach_hours: Math.round((ageHours - policy.sla_hours) * 100) / 100,
        });
      }
      return acc;
    }, [])
    .sort((a, b) => b.breach_hours - a.breach_hours);
}

// ── Approval gate ───────────────────────────────────────────────────────

/**
 * Check whether a thread has met the required-approvals threshold.
 * Counts distinct users who voted "approve" (option_key matches the
 * winning option or any option).
 */
export function checkApprovalGate(
  policy: ReviewerAutomationPolicyRecord,
  state: StoreState,
  threadId: string
): { met: boolean; current: number; required: number; voter_emails: string[] } {
  const thread = state.mastermind_threads.find((t) => t.id === threadId);
  if (!thread) {
    return { met: false, current: 0, required: policy.required_approvals, voter_emails: [] };
  }

  // Count distinct voters on this thread
  const voterMap = new Map<string, string>();
  for (const vote of state.mastermind_votes) {
    if (vote.thread_id === threadId) {
      voterMap.set(vote.user_id, vote.email);
    }
  }

  const voterEmails = Array.from(voterMap.values());
  const current = voterEmails.length;
  return {
    met: current >= policy.required_approvals,
    current,
    required: policy.required_approvals,
    voter_emails: voterEmails,
  };
}

// ── Policy status report ────────────────────────────────────────────────

/**
 * Build a status report for the reviewer automation policy in a scope.
 */
export function buildPolicyStatusReport(
  policy: ReviewerAutomationPolicyRecord,
  threads: MastermindThreadRecord[],
  nowMs: number
): PolicyStatusReport {
  const openThreads = threads.filter((t) => t.status === "open");
  const slaStatuses = checkThreadSla(policy, threads, nowMs);
  const breachedCount = slaStatuses.filter((s) => s.breached).length;

  return {
    scope_type: policy.scope_type,
    scope_id: policy.scope_id,
    enabled: policy.enabled,
    reviewer_count: policy.reviewer_emails.length,
    required_approvals: policy.required_approvals,
    sla_hours: policy.sla_hours,
    assignment_mode: policy.assignment_mode,
    escalation_email: policy.escalation_email,
    open_threads: openThreads.length,
    breached_threads: breachedCount,
    pending_assignments: openThreads.length,
    evaluated_at: new Date(nowMs).toISOString(),
  };
}

// ── Policy CRUD helpers ─────────────────────────────────────────────────

/**
 * Find the reviewer automation policy for a scope.
 */
export function findPolicyForScope(
  state: StoreState,
  scopeType: "user" | "team",
  scopeId: string
): ReviewerAutomationPolicyRecord | undefined {
  return state.reviewer_automation_policies.find(
    (p) => p.scope_type === scopeType && p.scope_id === scopeId
  );
}

/**
 * Build a default policy record for a scope.
 */
export function buildDefaultPolicy(
  scopeType: "user" | "team",
  scopeId: string,
  policyId: string,
  nowIso: string
): ReviewerAutomationPolicyRecord {
  return {
    id: policyId,
    scope_type: scopeType,
    scope_id: scopeId,
    enabled: false,
    reviewer_emails: [],
    required_approvals: 1,
    sla_hours: 24,
    escalation_email: null,
    assignment_mode: "all",
    last_assigned_index: 0,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/**
 * Apply a partial policy update to an existing record.
 * Returns the mutated record for convenience.
 */
export function applyPolicyUpdate(
  record: ReviewerAutomationPolicyRecord,
  input: ReviewerPolicyInput,
  normalizeEmailFn: (email: string | undefined) => string | undefined,
  nowIso: string
): ReviewerAutomationPolicyRecord {
  if (input.enabled !== undefined) {
    record.enabled = input.enabled;
  }
  if (input.reviewer_emails !== undefined) {
    record.reviewer_emails = input.reviewer_emails
      .map((e) => normalizeEmailFn(e))
      .filter((e): e is string => Boolean(e));
  }
  if (input.required_approvals !== undefined) {
    record.required_approvals = Math.max(
      MIN_REQUIRED_APPROVALS,
      Math.min(MAX_REQUIRED_APPROVALS, Math.round(input.required_approvals))
    );
  }
  if (input.sla_hours !== undefined) {
    record.sla_hours = Math.max(
      MIN_SLA_HOURS,
      Math.min(MAX_SLA_HOURS, Math.round(input.sla_hours))
    );
  }
  if (input.escalation_email !== undefined) {
    record.escalation_email =
      input.escalation_email === null
        ? null
        : normalizeEmailFn(input.escalation_email) ?? null;
  }
  if (input.assignment_mode !== undefined) {
    record.assignment_mode = input.assignment_mode;
  }
  record.updated_at = nowIso;
  return record;
}

/**
 * Build Slack notification text for reviewer assignment.
 */
export function buildAssignmentNotificationText(
  assignment: ReviewerAssignment,
  threadTitle: string
): string {
  const reviewers = assignment.assigned_emails.join(", ");
  return `📋 Reviewer assignment for thread "${threadTitle}": ${reviewers} (${assignment.assignment_mode})`;
}

/**
 * Build Slack notification text for SLA breach escalation.
 */
export function buildEscalationNotificationText(
  targets: EscalationTarget[]
): string {
  if (targets.length === 0) {
    return "";
  }
  const lines = targets.map(
    (t) =>
      `  • "${t.title}" — ${t.breach_hours}h past SLA (age: ${t.age_hours}h / limit: ${t.sla_hours}h)`
  );
  return `⚠️ SLA breach escalation (${targets.length} thread${targets.length > 1 ? "s" : ""}):\n${lines.join("\n")}`;
}
