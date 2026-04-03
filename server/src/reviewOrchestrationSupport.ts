import { createHash, randomUUID } from "crypto";
import type {
  StoreState
} from "./types";
import type { ReviewWorkflowAuditRecord, ReviewWorkflowRecord } from "./reviewOrchestrationTypes";

type JsonMap = Record<string, unknown>;

export const REVIEW_PAGE_LINE_LIMIT = 500;
export const REVIEW_HEARTBEAT_STALE_AFTER_SECONDS = 180;
export const REVIEW_MAX_AUDIT_RECORDS_PER_WORKFLOW = 200;
export const REVIEW_WORKER_LEASE_TTL_SECONDS = 120;

export function buildReviewWorkflowResponse(
  workflow: ReviewWorkflowRecord,
  snapshot: StoreState
): Record<string, unknown> {
  const auditCount = snapshot.review_workflow_audit_log.filter(
    (entry) => entry.workflow_id === workflow.id
  ).length;
  return {
    id: workflow.id,
    repo_key: workflow.repo_key,
    project_root: workflow.project_root,
    state: workflow.state,
    worker_lease: {
      lease_id: workflow.current_lease_id,
      expires_at: workflow.current_lease_expires_at,
      ttl_seconds: REVIEW_WORKER_LEASE_TTL_SECONDS,
      required: true
    },
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
    last_sync_action: workflow.last_sync_action,
    last_actor_role: workflow.last_actor_role,
    last_page_id: workflow.last_page_id,
    audit_count: auditCount,
    stale_agents: findStaleReviewAgents(workflow.state)
  };
}

export function buildReviewPolicy(): Record<string, unknown> {
  return {
    heartbeat_stale_after_seconds: REVIEW_HEARTBEAT_STALE_AFTER_SECONDS,
    review_page_line_limit: REVIEW_PAGE_LINE_LIMIT,
    worker_lease_ttl_seconds: REVIEW_WORKER_LEASE_TTL_SECONDS,
    local_detail_mode: "redacted_when_authenticated"
  };
}

export function issueReviewWorkerLease(now: Date = new Date()): {
  leaseId: string;
  expiresAt: string;
} {
  return {
    leaseId: randomUUID(),
    expiresAt: new Date(now.getTime() + REVIEW_WORKER_LEASE_TTL_SECONDS * 1000).toISOString()
  };
}

export function validateReviewWorkerLease(
  workflow: ReviewWorkflowRecord | null | undefined,
  providedLeaseId: string | undefined,
  action: string
): void {
  if (!workflow || action === "init") {
    return;
  }

  const expectedLeaseId = `${workflow.current_lease_id ?? ""}`.trim();
  const incomingLeaseId = `${providedLeaseId ?? ""}`.trim();
  if (!expectedLeaseId) {
    throw new Error("server-backed review worker lease is not initialized");
  }
  if (!incomingLeaseId) {
    throw new Error("lease_id is required for server-backed review sync");
  }
  if (incomingLeaseId !== expectedLeaseId) {
    throw new Error("server-backed review worker lease is invalid");
  }
  const expiresAt = `${workflow.current_lease_expires_at ?? ""}`.trim();
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw new Error("server-backed review worker lease expired; reload workflow state and retry");
  }
}

export function findReviewWorkflow(
  state: StoreState,
  userId: string,
  repoKey: string
): ReviewWorkflowRecord | undefined {
  return state.review_workflows.find((item) => item.user_id === userId && item.repo_key === repoKey);
}

export function upsertReviewWorkflow(state: StoreState, workflow: ReviewWorkflowRecord): void {
  const index = state.review_workflows.findIndex((item) => item.id === workflow.id);
  if (index >= 0) {
    state.review_workflows[index] = workflow;
    return;
  }
  state.review_workflows.push(workflow);
}

export function appendReviewAudit(
  state: StoreState,
  input: Omit<ReviewWorkflowAuditRecord, "id" | "created_at">
): void {
  state.review_workflow_audit_log.push({
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ...input
  });

  const recordsForWorkflow = state.review_workflow_audit_log.filter(
    (entry) => entry.workflow_id === input.workflow_id
  );
  if (recordsForWorkflow.length <= REVIEW_MAX_AUDIT_RECORDS_PER_WORKFLOW) {
    return;
  }

  const overflow = recordsForWorkflow.length - REVIEW_MAX_AUDIT_RECORDS_PER_WORKFLOW;
  let removed = 0;
  state.review_workflow_audit_log = state.review_workflow_audit_log.filter((entry) => {
    if (removed >= overflow || entry.workflow_id !== input.workflow_id) {
      return true;
    }
    removed += 1;
    return false;
  });
}

export function validateReviewSyncAction(
  previousState: Record<string, unknown> | null,
  nextState: Record<string, unknown>,
  context: { action: string; actorRole: "builder" | "reviewer" | null; pageId: string | null }
): { status: string; summary: string } {
  const pageId = context.pageId?.trim() || null;
  const page = pageId ? findReviewPage(nextState, pageId) : null;

  switch (context.action) {
    case "start-role":
      return validateReviewStartRole(nextState, context.actorRole);
    case "report":
      return validateReviewReport(page, pageId, context.action);
    case "respond":
      return validateReviewRespond(page, pageId, context.action);
    case "approve":
      return validateReviewApprove(page, pageId, context.action);
    case "end":
      return validateReviewEnd(nextState);
    default:
      return { status: context.action, summary: summarizeReviewCounts(previousState, nextState) };
  }
}

export function findStaleReviewAgents(state: Record<string, unknown>): string[] {
  const roles = getObject(state, "roles");
  const stale: string[] = [];
  for (const roleName of ["builder", "reviewer"] as const) {
    const role = getObject(roles, roleName);
    const heartbeat = getString(role, "last_heartbeat_utc");
    if (!heartbeat) {
      continue;
    }
    const ageSeconds = Math.floor((Date.now() - new Date(heartbeat).getTime()) / 1000);
    if (Number.isFinite(ageSeconds) && ageSeconds > REVIEW_HEARTBEAT_STALE_AFTER_SECONDS) {
      stale.push(roleName);
    }
  }
  return stale;
}

export function validateReviewStateShape(state: Record<string, unknown>): void {
  if (!getString(state, "project_root")) {
    throw new Error("review workflow state requires project_root");
  }
  getObject(state, "workflow");
  getObject(state, "roles");
  getObject(state, "summary");
  getArray(state, "pages");
}

export function resolveReviewRepoKey(repoKey: string | undefined, projectRoot: string | undefined): string {
  const trimmedRepoKey = `${repoKey ?? ""}`.trim();
  if (trimmedRepoKey) {
    return trimmedRepoKey.toLowerCase();
  }
  const normalizedRoot = `${projectRoot ?? ""}`.trim().toLowerCase();
  if (!normalizedRoot) {
    throw new Error("repo_key or project_root is required");
  }
  return createHash("sha256").update(normalizedRoot).digest("hex").slice(0, 16);
}

export function normalizeReviewRole(value: unknown): "builder" | "reviewer" | null {
  const candidate = `${value ?? ""}`.trim().toLowerCase();
  return candidate === "builder" || candidate === "reviewer" ? candidate : null;
}

export function getRequiredReviewString(
  state: Record<string, unknown>,
  key: string,
  fallback?: string
): string {
  const value = getString(state, key) || `${fallback ?? ""}`.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function ensureReviewStatePayload(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error("state payload must be a JSON object");
  }
  return value;
}

export function clampReviewInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function validateReviewStartRole(
  nextState: Record<string, unknown>,
  actorRole: "builder" | "reviewer" | null
): { status: string; summary: string } {
  if (!actorRole) {
    throw new Error("role is required for start-role sync");
  }
  const roles = getObject(nextState, "roles");
  const role = getObject(roles, actorRole);
  const agentId = getString(role, "agent_id");
  if (!agentId) {
    throw new Error(`missing roles.${actorRole}.agent_id in synced state`);
  }
  return { status: "started", summary: `${actorRole} agent ${agentId} claimed the workflow.` };
}

function validateReviewReport(
  page: Record<string, unknown> | null,
  pageId: string | null,
  action: string
): { status: string; summary: string } {
  const reportPage = requireReviewPage(page, pageId, action);
  if (getString(reportPage, "status") !== "changes_requested") {
    throw new Error("report sync requires page status changes_requested");
  }
  const findings = getArray(reportPage, "findings");
  if (findings.length === 0) {
    throw new Error("report sync requires at least one review finding");
  }
  return { status: "changes_requested", summary: `Reviewer reported findings for ${pageId}.` };
}

function validateReviewRespond(
  page: Record<string, unknown> | null,
  pageId: string | null,
  action: string
): { status: string; summary: string } {
  const responsePage = requireReviewPage(page, pageId, action);
  const responses = getArray(responsePage, "responses");
  if (responses.length === 0) {
    throw new Error("respond sync requires at least one builder response");
  }
  const status = getString(responsePage, "status");
  if (!["ready_for_review", "builder_replied"].includes(status)) {
    throw new Error("respond sync has an invalid page status");
  }
  return { status, summary: `Builder responded for ${pageId}.` };
}

function validateReviewApprove(
  page: Record<string, unknown> | null,
  pageId: string | null,
  action: string
): { status: string; summary: string } {
  const approvedPage = requireReviewPage(page, pageId, action);
  if (getString(approvedPage, "status") !== "approved") {
    throw new Error("approve sync requires page status approved");
  }
  const findings = getArray(approvedPage, "findings");
  const stillOpen = findings.some((entry) => {
    if (!isPlainObject(entry)) {
      return false;
    }
    const status = getString(entry, "status");
    return ["open", "needs_fix", "builder_replied", "blocked"].includes(status);
  });
  if (stillOpen) {
    throw new Error("approve sync cannot leave open findings on the page");
  }
  return { status: "approved", summary: `Reviewer approved ${pageId}.` };
}

function validateReviewEnd(nextState: Record<string, unknown>): { status: string; summary: string } {
  const workflow = getObject(nextState, "workflow");
  if (getString(workflow, "status") !== "completed") {
    throw new Error("end sync requires workflow status completed");
  }
  return { status: "completed", summary: "Review workflow was completed." };
}

function summarizeReviewCounts(previousState: Record<string, unknown> | null, nextState: Record<string, unknown>): string {
  const previousPages = previousState ? getArray(previousState, "pages") : [];
  const nextPages = getArray(nextState, "pages");
  return `Review pages tracked: ${previousPages.length} -> ${nextPages.length}.`;
}

function findReviewPage(state: Record<string, unknown>, pageId: string): Record<string, unknown> | null {
  const pages = getArray(state, "pages");
  for (const entry of pages) {
    if (!isPlainObject(entry)) {
      continue;
    }
    if (getString(entry, "page_id") === pageId) {
      return entry;
    }
  }
  return null;
}

function requireReviewPage(
  page: Record<string, unknown> | null,
  pageId: string | null,
  action: string
): Record<string, unknown> {
  if (!page || !pageId) {
    throw new Error(`${action} sync requires a valid page_id`);
  }
  return page;
}

function getObject(value: unknown, key: string): JsonMap {
  if (!isPlainObject(value)) {
    throw new Error(`expected object for ${key}`);
  }
  const candidate = (value as JsonMap)[key];
  if (!isPlainObject(candidate)) {
    throw new Error(`expected object at ${key}`);
  }
  return candidate;
}

function getArray(value: unknown, key: string): unknown[] {
  if (!isPlainObject(value)) {
    throw new Error(`expected object for ${key}`);
  }
  const candidate = (value as JsonMap)[key];
  if (!Array.isArray(candidate)) {
    throw new Error(`expected array at ${key}`);
  }
  return candidate;
}

function getString(value: unknown, key: string): string {
  if (!isPlainObject(value)) {
    return "";
  }
  const candidate = (value as JsonMap)[key];
  return typeof candidate === "string" ? candidate.trim() : "";
}

function isPlainObject(value: unknown): value is JsonMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}