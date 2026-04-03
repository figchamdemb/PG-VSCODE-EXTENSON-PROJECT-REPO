import { createHash } from "crypto";
import type {
  FrontendIntegrationAuditRecord,
  FrontendIntegrationWorkflowRecord,
  StoreState
} from "./types";

type JsonMap = Record<string, unknown>;

export const PAGE_LINE_LIMIT = 500;
export const HEARTBEAT_STALE_AFTER_SECONDS = 180;
export const MAX_AUDIT_RECORDS_PER_WORKFLOW = 200;
export const WORKER_LEASE_TTL_SECONDS = 120;

export function buildWorkflowResponse(
  workflow: FrontendIntegrationWorkflowRecord,
  snapshot: StoreState
): Record<string, unknown> {
  const auditCount = snapshot.frontend_integration_audit_log.filter(
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
      ttl_seconds: WORKER_LEASE_TTL_SECONDS,
      required: true
    },
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
    last_sync_action: workflow.last_sync_action,
    last_actor_role: workflow.last_actor_role,
    last_page_id: workflow.last_page_id,
    audit_count: auditCount,
    stale_agents: findStaleAgents(workflow.state)
  };
}

export function buildPolicy(): Record<string, unknown> {
  return {
    heartbeat_stale_after_seconds: HEARTBEAT_STALE_AFTER_SECONDS,
    frontend_page_line_limit: PAGE_LINE_LIMIT,
    worker_lease_ttl_seconds: WORKER_LEASE_TTL_SECONDS,
    local_detail_mode: "redacted_when_authenticated"
  };
}

export function issueWorkerLease(now: Date = new Date()): {
  leaseId: string;
  expiresAt: string;
} {
  return {
    leaseId: cryptoRandomId(),
    expiresAt: new Date(now.getTime() + WORKER_LEASE_TTL_SECONDS * 1000).toISOString()
  };
}

export function validateWorkerLease(
  workflow: FrontendIntegrationWorkflowRecord | null | undefined,
  providedLeaseId: string | undefined,
  action: string
): void {
  if (!workflow || action === "init") {
    return;
  }

  const expectedLeaseId = `${workflow.current_lease_id ?? ""}`.trim();
  const incomingLeaseId = `${providedLeaseId ?? ""}`.trim();
  if (!expectedLeaseId) {
    throw new Error("server-backed worker lease is not initialized");
  }
  if (!incomingLeaseId) {
    throw new Error("lease_id is required for server-backed integration sync");
  }
  if (incomingLeaseId !== expectedLeaseId) {
    throw new Error("server-backed worker lease is invalid");
  }
  const expiresAt = `${workflow.current_lease_expires_at ?? ""}`.trim();
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw new Error("server-backed worker lease expired; reload workflow state and retry");
  }
}

export function findWorkflow(
  state: StoreState,
  userId: string,
  repoKey: string
): FrontendIntegrationWorkflowRecord | undefined {
  return state.frontend_integration_workflows.find(
    (item) => item.user_id === userId && item.repo_key === repoKey
  );
}

export function upsertWorkflow(state: StoreState, workflow: FrontendIntegrationWorkflowRecord): void {
  const index = state.frontend_integration_workflows.findIndex((item) => item.id === workflow.id);
  if (index >= 0) {
    state.frontend_integration_workflows[index] = workflow;
    return;
  }
  state.frontend_integration_workflows.push(workflow);
}

export function appendAudit(
  state: StoreState,
  input: Omit<FrontendIntegrationAuditRecord, "id" | "created_at">
): void {
  state.frontend_integration_audit_log.push({
    id: cryptoRandomId(),
    created_at: new Date().toISOString(),
    ...input
  });

  const recordsForWorkflow = state.frontend_integration_audit_log.filter(
    (entry) => entry.workflow_id === input.workflow_id
  );
  if (recordsForWorkflow.length <= MAX_AUDIT_RECORDS_PER_WORKFLOW) {
    return;
  }

  const overflow = recordsForWorkflow.length - MAX_AUDIT_RECORDS_PER_WORKFLOW;
  let removed = 0;
  state.frontend_integration_audit_log = state.frontend_integration_audit_log.filter((entry) => {
    if (removed >= overflow || entry.workflow_id !== input.workflow_id) {
      return true;
    }
    removed += 1;
    return false;
  });
}

export function validateSyncAction(
  previousState: Record<string, unknown> | null,
  nextState: Record<string, unknown>,
  context: { action: string; actorRole: "backend" | "frontend" | null; pageId: string | null }
): { status: string; summary: string } {
  const pageId = context.pageId?.trim() || null;
  const page = pageId ? findPage(nextState, pageId) : null;

  switch (context.action) {
    case "start-role":
      return validateStartRole(nextState, context.actorRole);
    case "ready":
      return validateReady(page, pageId, context.action);
    case "complete":
      return validateComplete(page, pageId, context.action);
    case "report":
      return validateReport(page, pageId, context.action);
    case "respond":
      return validateRespond(page, pageId, context.action);
    default:
      return { status: context.action, summary: summarizeCounts(previousState, nextState) };
  }
}

export function findStaleAgents(state: Record<string, unknown>): string[] {
  const stale: string[] = [];
  for (const role of ["backend", "frontend"] as const) {
    const agent = getObject(state, `${role}_agent`);
    const heartbeat = getString(agent, "last_heartbeat_utc");
    if (!heartbeat) {
      continue;
    }
    const ageSeconds = Math.floor((Date.now() - new Date(heartbeat).getTime()) / 1000);
    if (Number.isFinite(ageSeconds) && ageSeconds > HEARTBEAT_STALE_AFTER_SECONDS) {
      stale.push(role);
    }
  }
  return stale;
}

export function validateStateShape(state: Record<string, unknown>): void {
  if (!getString(state, "project_root")) {
    throw new Error("frontend integration state requires project_root");
  }
  getObject(state, "summary");
  getArray(state, "pages");
}

export function resolveRepoKey(repoKey: string | undefined, projectRoot: string | undefined): string {
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

export function normalizeRole(value: unknown): "backend" | "frontend" | null {
  const candidate = `${value ?? ""}`.trim().toLowerCase();
  return candidate === "backend" || candidate === "frontend" ? candidate : null;
}

export function getRequiredString(
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

export function ensureStatePayload(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error("state payload must be a JSON object");
  }
  return value;
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function validateStartRole(
  nextState: Record<string, unknown>,
  actorRole: "backend" | "frontend" | null
): { status: string; summary: string } {
  if (!actorRole) {
    throw new Error("role is required for start-role sync");
  }
  const agent = getObject(nextState, `${actorRole}_agent`);
  const agentId = getString(agent, "agent_id");
  if (!agentId) {
    throw new Error(`missing ${actorRole}_agent.agent_id in synced state`);
  }
  return { status: "started", summary: `${actorRole} agent ${agentId} claimed the workflow.` };
}

function validateReady(
  page: Record<string, unknown> | null,
  pageId: string | null,
  action: string
): { status: string; summary: string } {
  const readyPage = requirePage(page, pageId, action);
  if (getString(readyPage, "status") !== "ready_for_frontend") {
    throw new Error("ready sync requires page status ready_for_frontend");
  }
  if (getString(readyPage, "owner_role") !== "backend") {
    throw new Error("ready sync requires backend ownership");
  }
  const backend = getObject(readyPage, "backend");
  if (getString(backend, "smoke_status") !== "pass") {
    throw new Error("ready sync requires backend smoke_status=pass");
  }
  return { status: "ready_for_frontend", summary: `Backend marked ${pageId} ready for frontend.` };
}

function validateComplete(
  page: Record<string, unknown> | null,
  pageId: string | null,
  action: string
): { status: string; summary: string } {
  const completedPage = requirePage(page, pageId, action);
  if (getString(completedPage, "status") !== "done") {
    throw new Error("complete sync requires page status done");
  }
  if (getString(completedPage, "owner_role") !== "frontend") {
    throw new Error("complete sync requires frontend ownership");
  }
  const validation = getObject(completedPage, "validation");
  const lineCount = getNumber(validation, "frontend_page_line_count");
  if (lineCount > PAGE_LINE_LIMIT) {
    throw new Error(`frontend page line count cannot exceed ${PAGE_LINE_LIMIT}`);
  }
  if (!hasOwnProperty(validation, "trust_status") || !hasOwnProperty(validation, "self_check_status")) {
    throw new Error("complete sync requires trust_status and self_check_status");
  }
  return { status: "done", summary: `Frontend completed ${pageId}.` };
}

function validateReport(
  page: Record<string, unknown> | null,
  pageId: string | null,
  action: string
): { status: string; summary: string } {
  const reportPage = requirePage(page, pageId, action);
  const status = getString(reportPage, "status");
  if (status !== "pending_backend_correction" && status !== "blocked_on_developer") {
    throw new Error("report sync requires a correction or developer-blocked page state");
  }
  const handoff = getObject(reportPage, "handoff");
  if (getArray(handoff, "findings").length === 0) {
    throw new Error("report sync requires at least one frontend finding");
  }
  return { status, summary: `Frontend reported a finding for ${pageId}.` };
}

function validateRespond(
  page: Record<string, unknown> | null,
  pageId: string | null,
  action: string
): { status: string; summary: string } {
  const responsePage = requirePage(page, pageId, action);
  const handoff = getObject(responsePage, "handoff");
  if (getArray(handoff, "responses").length === 0) {
    throw new Error("respond sync requires at least one backend response");
  }
  const status = getString(responsePage, "status");
  if (!["ready_for_frontend", "pending_backend_correction", "blocked_on_developer", "rejected_by_backend"].includes(status)) {
    throw new Error("respond sync has an invalid page status");
  }
  return { status, summary: `Backend responded for ${pageId}.` };
}

function summarizeCounts(previousState: Record<string, unknown> | null, nextState: Record<string, unknown>): string {
  const previousPages = previousState ? getArray(previousState, "pages") : [];
  const nextPages = getArray(nextState, "pages");
  return `Pages tracked: ${previousPages.length} -> ${nextPages.length}.`;
}

function findPage(state: Record<string, unknown>, pageId: string): Record<string, unknown> | null {
  const normalized = normalizeMatch(pageId);
  for (const page of getArray(state, "pages")) {
    const pageMap = ensureStatePayload(page);
    const candidates = [getString(pageMap, "page_id"), getString(pageMap, "page_name"), getString(pageMap, "page_file")]
      .map((candidate) => normalizeMatch(candidate))
      .filter(Boolean);
    if (candidates.some((candidate) => candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate))) {
      return pageMap;
    }
  }
  return null;
}

function requirePage(
  page: Record<string, unknown> | null,
  pageId: string | null,
  action: string
): Record<string, unknown> {
  if (!page || !pageId) {
    throw new Error(`${action} sync requires a valid page_id`);
  }
  return page;
}

function isPlainObject(value: unknown): value is JsonMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getObject(target: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = target[key];
  if (!isPlainObject(value)) {
    throw new Error(`expected object at ${key}`);
  }
  return value;
}

function getArray(target: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = target[key];
  if (!Array.isArray(value)) {
    throw new Error(`expected array at ${key}`);
  }
  return value.map((item) => ensureStatePayload(item));
}

function getString(target: Record<string, unknown>, key: string): string {
  const value = target[key];
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(target: Record<string, unknown>, key: string): number {
  const value = target[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function hasOwnProperty(target: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function normalizeMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function cryptoRandomId(): string {
  return require("crypto").randomUUID();
}