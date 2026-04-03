import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getMatrixEntry } from "./entitlementMatrix";
import type { StoreState } from "./types";
import type { ReviewWorkflowRecord } from "./reviewOrchestrationTypes";
import {
  appendReviewAudit,
  buildReviewPolicy,
  buildReviewWorkflowResponse,
  clampReviewInt,
  ensureReviewStatePayload,
  findReviewWorkflow,
  getRequiredReviewString,
  issueReviewWorkerLease,
  normalizeReviewRole,
  resolveReviewRepoKey,
  upsertReviewWorkflow,
  validateReviewStateShape,
  validateReviewSyncAction,
  validateReviewWorkerLease
} from "./reviewOrchestrationSupport";

type AuthResult = { user: { id: string } };
type JsonMap = Record<string, unknown>;

export type RegisterReviewOrchestrationRoutesDeps = {
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => AuthResult | undefined;
  resolveEffectivePlan: (state: StoreState, userId: string, now: Date) => { plan: import("./types").PlanTier };
  safeLogInfo: (message: string, context?: Record<string, unknown>) => void;
  store: {
    snapshot: () => StoreState;
    update: (mutator: (state: StoreState) => void) => Promise<void>;
  };
};

export function registerReviewOrchestrationRoutes(
  app: FastifyInstance,
  deps: RegisterReviewOrchestrationRoutesDeps
): void {
  function ensureReviewAccess(userId: string, reply: FastifyReply): boolean {
    const snapshot = deps.store.snapshot();
    const plan = deps.resolveEffectivePlan(snapshot, userId, new Date()).plan;
    if (!getMatrixEntry(plan).ext_review_workflow) {
      reply.code(403).send({
        error: "secure review workflow requires an active Pro, Team, or Enterprise entitlement"
      });
      return false;
    }
    return true;
  }

  app.get<{
    Querystring: { repo_key?: string; project_root?: string };
  }>("/account/review/orchestration/state", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    if (!ensureReviewAccess(auth.user.id, reply)) {
      return;
    }

    const repoKey = resolveReviewRepoKey(request.query?.repo_key, request.query?.project_root);
    let snapshot = deps.store.snapshot();
    let workflow = findReviewWorkflow(snapshot, auth.user.id, repoKey);
    if (workflow) {
      const lease = issueReviewWorkerLease(new Date());
      await deps.store.update((state) => {
        const current = findReviewWorkflow(state, auth.user.id, repoKey);
        if (!current) {
          return;
        }
        current.current_lease_id = lease.leaseId;
        current.current_lease_expires_at = lease.expiresAt;
        current.updated_at = new Date().toISOString();
        upsertReviewWorkflow(state, current);
      });
      snapshot = deps.store.snapshot();
      workflow = findReviewWorkflow(snapshot, auth.user.id, repoKey);
    }

    return {
      ok: true,
      repo_key: repoKey,
      policy: buildReviewPolicy(),
      workflow: workflow ? buildReviewWorkflowResponse(workflow, snapshot) : null
    };
  });

  app.get<{
    Querystring: { repo_key?: string; project_root?: string; limit?: number };
  }>("/account/review/orchestration/audit", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    if (!ensureReviewAccess(auth.user.id, reply)) {
      return;
    }

    const repoKey = resolveReviewRepoKey(request.query?.repo_key, request.query?.project_root);
    const limit = clampReviewInt(Number(request.query?.limit ?? 30), 1, 100);
    const snapshot = deps.store.snapshot();
    const workflow = findReviewWorkflow(snapshot, auth.user.id, repoKey);
    const audit = workflow
      ? snapshot.review_workflow_audit_log
          .filter((entry) => entry.workflow_id === workflow.id)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .slice(0, limit)
      : [];
    return {
      ok: true,
      repo_key: repoKey,
      audit
    };
  });

  app.post<{
    Body: { repo_key?: string; project_root?: string; state?: JsonMap };
  }>("/account/review/orchestration/init", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    if (!ensureReviewAccess(auth.user.id, reply)) {
      return;
    }

    const incomingState = ensureReviewStatePayload(request.body?.state);
    const projectRoot = getRequiredReviewString(incomingState, "project_root", request.body?.project_root);
    const repoKey = resolveReviewRepoKey(request.body?.repo_key, projectRoot);
    validateReviewStateShape(incomingState);

    let workflowId = "";
    await deps.store.update((state) => {
      const existing = findReviewWorkflow(state, auth.user.id, repoKey);
      const nowIso = new Date().toISOString();
      const lease = issueReviewWorkerLease(new Date());
      const workflow: ReviewWorkflowRecord = existing ?? {
        id: randomUUID(),
        user_id: auth.user.id,
        repo_key: repoKey,
        project_root: projectRoot,
        state: {},
        current_lease_id: null,
        current_lease_expires_at: null,
        last_sync_action: "init",
        last_actor_role: null,
        last_page_id: null,
        created_at: nowIso,
        updated_at: nowIso
      };
      workflow.project_root = projectRoot;
      workflow.state = incomingState;
      workflow.current_lease_id = lease.leaseId;
      workflow.current_lease_expires_at = lease.expiresAt;
      workflow.last_sync_action = "init";
      workflow.last_actor_role = null;
      workflow.last_page_id = null;
      workflow.updated_at = nowIso;
      workflowId = workflow.id;
      upsertReviewWorkflow(state, workflow);
      appendReviewAudit(state, {
        workflow_id: workflow.id,
        user_id: auth.user.id,
        repo_key: repoKey,
        action: "init",
        actor_role: null,
        page_id: null,
        outcome_status: "initialized",
        summary: "Initialized server-backed review workflow."
      });
    });

    const snapshot = deps.store.snapshot();
    const workflow = snapshot.review_workflows.find((item) => item.id === workflowId) ?? null;
    deps.safeLogInfo("Review workflow initialized", {
      user_id: auth.user.id,
      repo_key: repoKey,
      mode: "server"
    });
    return {
      ok: true,
      repo_key: repoKey,
      policy: buildReviewPolicy(),
      workflow: workflow ? buildReviewWorkflowResponse(workflow, snapshot) : null
    };
  });

  app.post<{
    Body: {
      repo_key?: string;
      project_root?: string;
      action?: string;
      role?: "builder" | "reviewer" | "";
      page_id?: string;
      lease_id?: string;
      state?: JsonMap;
    };
  }>("/account/review/orchestration/sync", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    if (!ensureReviewAccess(auth.user.id, reply)) {
      return;
    }

    const action = `${request.body?.action ?? ""}`.trim();
    if (!action) {
      return reply.code(400).send({ error: "action is required" });
    }
    const incomingState = ensureReviewStatePayload(request.body?.state);
    const projectRoot = getRequiredReviewString(incomingState, "project_root", request.body?.project_root);
    const repoKey = resolveReviewRepoKey(request.body?.repo_key, projectRoot);
    const actorRole = normalizeReviewRole(request.body?.role);

    const previousSnapshot = deps.store.snapshot();
    const previousWorkflow = findReviewWorkflow(previousSnapshot, auth.user.id, repoKey);
    let syncSummary: { status: string; summary: string };
    try {
      validateReviewStateShape(incomingState);
      validateReviewWorkerLease(previousWorkflow ?? null, request.body?.lease_id, action);
      syncSummary = validateReviewSyncAction(previousWorkflow?.state ?? null, incomingState, {
        action,
        actorRole,
        pageId: request.body?.page_id ?? null
      });
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "invalid review sync request";
      const statusCode = message.includes("lease") ? 409 : 400;
      return reply.code(statusCode).send({ error: message });
    }

    let workflowId = "";
    await deps.store.update((state) => {
      const nowIso = new Date().toISOString();
      const lease = issueReviewWorkerLease(new Date());
      const existing = findReviewWorkflow(state, auth.user.id, repoKey);
      const workflow: ReviewWorkflowRecord = existing ?? {
        id: randomUUID(),
        user_id: auth.user.id,
        repo_key: repoKey,
        project_root: projectRoot,
        state: {},
        current_lease_id: null,
        current_lease_expires_at: null,
        last_sync_action: action,
        last_actor_role: actorRole,
        last_page_id: request.body?.page_id?.trim() || null,
        created_at: nowIso,
        updated_at: nowIso
      };
      workflow.project_root = projectRoot;
      workflow.state = incomingState;
      workflow.current_lease_id = lease.leaseId;
      workflow.current_lease_expires_at = lease.expiresAt;
      workflow.last_sync_action = action;
      workflow.last_actor_role = actorRole;
      workflow.last_page_id = request.body?.page_id?.trim() || null;
      workflow.updated_at = nowIso;
      workflowId = workflow.id;
      upsertReviewWorkflow(state, workflow);
      appendReviewAudit(state, {
        workflow_id: workflow.id,
        user_id: auth.user.id,
        repo_key: repoKey,
        action,
        actor_role: actorRole,
        page_id: workflow.last_page_id,
        outcome_status: syncSummary.status,
        summary: syncSummary.summary
      });
    });

    const snapshot = deps.store.snapshot();
    const workflow = snapshot.review_workflows.find((item) => item.id === workflowId) ?? null;
    deps.safeLogInfo("Review workflow synced", {
      user_id: auth.user.id,
      repo_key: repoKey,
      action,
      actor_role: actorRole,
      page_id: request.body?.page_id ?? null,
      sync_status: syncSummary.status
    });
    return {
      ok: true,
      repo_key: repoKey,
      policy: buildReviewPolicy(),
      workflow: workflow ? buildReviewWorkflowResponse(workflow, snapshot) : null,
      sync_status: syncSummary.status,
      sync_summary: syncSummary.summary
    };
  });
}