import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getMatrixEntry } from "./entitlementMatrix";
import type { FrontendIntegrationAuditRecord, FrontendIntegrationWorkflowRecord, StoreState } from "./types";
import {
  appendAudit,
  buildPolicy,
  buildWorkflowResponse,
  clampInt,
  ensureStatePayload,
  findWorkflow,
  getRequiredString,
  issueWorkerLease,
  normalizeRole,
  resolveRepoKey,
  upsertWorkflow,
  validateStateShape,
  validateSyncAction,
  validateWorkerLease
} from "./integrationOrchestrationSupport";

type AuthResult = { user: { id: string } };

type JsonMap = Record<string, unknown>;

export type RegisterIntegrationOrchestrationRoutesDeps = {
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

export function registerIntegrationOrchestrationRoutes(
  app: FastifyInstance,
  deps: RegisterIntegrationOrchestrationRoutesDeps
): void {
  function ensureIntegrationAccess(userId: string, reply: FastifyReply): boolean {
    const snapshot = deps.store.snapshot();
    const plan = deps.resolveEffectivePlan(snapshot, userId, new Date()).plan;
    if (!getMatrixEntry(plan).ext_frontend_backend_integration) {
      reply.code(403).send({
        error: "frontend/backend integration requires an active Pro, Team, or Enterprise entitlement"
      });
      return false;
    }
    return true;
  }

  app.get<{
    Querystring: { repo_key?: string; project_root?: string };
  }>("/account/integration/orchestration/state", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    if (!ensureIntegrationAccess(auth.user.id, reply)) {
      return;
    }

    const repoKey = resolveRepoKey(request.query?.repo_key, request.query?.project_root);
    let snapshot = deps.store.snapshot();
    let workflow = findWorkflow(snapshot, auth.user.id, repoKey);
    if (workflow) {
      const lease = issueWorkerLease(new Date());
      await deps.store.update((state) => {
        const current = findWorkflow(state, auth.user.id, repoKey);
        if (!current) {
          return;
        }
        current.current_lease_id = lease.leaseId;
        current.current_lease_expires_at = lease.expiresAt;
        current.updated_at = new Date().toISOString();
        upsertWorkflow(state, current);
      });
      snapshot = deps.store.snapshot();
      workflow = findWorkflow(snapshot, auth.user.id, repoKey);
    }
    return {
      ok: true,
      repo_key: repoKey,
      policy: buildPolicy(),
      workflow: workflow ? buildWorkflowResponse(workflow, snapshot) : null
    };
  });

  app.get<{
    Querystring: { repo_key?: string; project_root?: string; limit?: number };
  }>("/account/integration/orchestration/audit", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    if (!ensureIntegrationAccess(auth.user.id, reply)) {
      return;
    }

    const repoKey = resolveRepoKey(request.query?.repo_key, request.query?.project_root);
    const limit = clampInt(Number(request.query?.limit ?? 30), 1, 100);
    const snapshot = deps.store.snapshot();
    const workflow = findWorkflow(snapshot, auth.user.id, repoKey);
    const audit = workflow
      ? snapshot.frontend_integration_audit_log
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
  }>("/account/integration/orchestration/init", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    if (!ensureIntegrationAccess(auth.user.id, reply)) {
      return;
    }

    const incomingState = ensureStatePayload(request.body?.state);
    const projectRoot = getRequiredString(incomingState, "project_root", request.body?.project_root);
    const repoKey = resolveRepoKey(request.body?.repo_key, projectRoot);
    validateStateShape(incomingState);

    let workflowId = "";
    await deps.store.update((state) => {
      const existing = findWorkflow(state, auth.user.id, repoKey);
      const nowIso = new Date().toISOString();
      const lease = issueWorkerLease(new Date());
      const workflow: FrontendIntegrationWorkflowRecord = existing ?? {
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
      upsertWorkflow(state, workflow);
      appendAudit(state, {
        workflow_id: workflow.id,
        user_id: auth.user.id,
        repo_key: repoKey,
        action: "init",
        actor_role: null,
        page_id: null,
        outcome_status: "initialized",
        summary: "Initialized server-backed frontend integration workflow."
      });
    });

    const snapshot = deps.store.snapshot();
    const workflow = snapshot.frontend_integration_workflows.find((item) => item.id === workflowId) ?? null;
    deps.safeLogInfo("Frontend integration workflow initialized", {
      user_id: auth.user.id,
      repo_key: repoKey,
      mode: "server"
    });
    return {
      ok: true,
      repo_key: repoKey,
      policy: buildPolicy(),
      workflow: workflow ? buildWorkflowResponse(workflow, snapshot) : null
    };
  });

  app.post<{
    Body: {
      repo_key?: string;
      project_root?: string;
      action?: string;
      role?: "backend" | "frontend" | "";
      page_id?: string;
      lease_id?: string;
      state?: JsonMap;
    };
  }>("/account/integration/orchestration/sync", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) {
      return;
    }
    if (!ensureIntegrationAccess(auth.user.id, reply)) {
      return;
    }

    const action = `${request.body?.action ?? ""}`.trim();
    if (!action) {
      return reply.code(400).send({ error: "action is required" });
    }
    const incomingState = ensureStatePayload(request.body?.state);
    const projectRoot = getRequiredString(incomingState, "project_root", request.body?.project_root);
    const repoKey = resolveRepoKey(request.body?.repo_key, projectRoot);
    const actorRole = normalizeRole(request.body?.role);

    const previousSnapshot = deps.store.snapshot();
    const previousWorkflow = findWorkflow(previousSnapshot, auth.user.id, repoKey);
    let syncSummary: { status: string; summary: string };
    try {
      validateStateShape(incomingState);
      validateWorkerLease(previousWorkflow ?? null, request.body?.lease_id, action);
      syncSummary = validateSyncAction(previousWorkflow?.state ?? null, incomingState, {
        action,
        actorRole,
        pageId: request.body?.page_id ?? null
      });
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "invalid integration sync request";
      const statusCode = message.includes("lease") ? 409 : 400;
      return reply.code(statusCode).send({ error: message });
    }

    let workflowId = "";
    await deps.store.update((state) => {
      const nowIso = new Date().toISOString();
      const lease = issueWorkerLease(new Date());
      const existing = findWorkflow(state, auth.user.id, repoKey);
      const workflow: FrontendIntegrationWorkflowRecord = existing ?? {
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
      upsertWorkflow(state, workflow);
      appendAudit(state, {
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
    const workflow = snapshot.frontend_integration_workflows.find((item) => item.id === workflowId) ?? null;
    deps.safeLogInfo("Frontend integration workflow synced", {
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
      policy: buildPolicy(),
      workflow: workflow ? buildWorkflowResponse(workflow, snapshot) : null,
      sync_status: syncSummary.status,
      sync_summary: syncSummary.summary
    };
  });
}