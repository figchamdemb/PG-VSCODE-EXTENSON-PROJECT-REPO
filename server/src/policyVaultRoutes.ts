/**
 * Policy Vault Routes
 * Milestone 10E – Private framework/checklist policy vault.
 *
 * Summary-only API endpoints.  Clients see pack metadata, version,
 * rule counts, and overlay status — never raw rule bodies or weights.
 *
 * Routes:
 *   GET  /account/policy/vault/packs        – list packs for user plan
 *   GET  /account/policy/vault/pack/:domain  – single pack detail
 *   GET  /account/policy/vault/resolve/:domain – resolved thresholds (admin debug)
 *   GET  /account/policy/vault/overlay       – get tenant overlay for user
 *   PUT  /account/policy/vault/overlay       – create/update tenant overlay
 *   DELETE /account/policy/vault/overlay     – delete tenant overlay
 */

import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PlanTier, PolicyTenantOverlayRecord, StoreState } from "./types";
import type { PolicyDomain } from "./policyVaultTypes";
import {
  ALL_POLICY_DOMAINS,
  buildTenantOverlay,
  countOverrideFields,
  getAvailablePacks,
  getPackDetail,
  getPolicyPackVersion,
  resolvePolicyPack
} from "./policyPackRegistry";

// ── Deps ────────────────────────────────────────────────────────────────

type AuthResult = { user: { id: string } };
type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

export interface RegisterPolicyVaultRoutesDeps {
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => AuthResult | undefined;
  store: {
    snapshot: () => StoreState;
    update: (mutator: (state: StoreState) => void) => Promise<void>;
  };
  resolveEffectivePlan: (
    state: StoreState,
    userId: string,
    now: Date
  ) => { plan: PlanTier };
  requireAdminPermission: (
    request: FastifyRequest,
    reply: FastifyReply,
    permissionKey: string
  ) => Promise<AdminAccessContext | undefined>;
  adminPermissionKeys: { BOARD_READ: string };
  adminRoutePrefix: string;
  safeLogInfo: (
    message: string,
    context?: Record<string, unknown>
  ) => void;
}

// ── Route registration ──────────────────────────────────────────────────

export function registerPolicyVaultRoutes(
  app: FastifyInstance,
  deps: RegisterPolicyVaultRoutesDeps
): void {
  const {
    requireAuth,
    store,
    resolveEffectivePlan,
    requireAdminPermission,
    adminPermissionKeys,
    adminRoutePrefix,
    safeLogInfo
  } = deps;

  // ── List available packs for the user's plan ──────────────────────────

  app.get("/account/policy/vault/packs", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return;

    const state = store.snapshot();
    const { plan } = resolveEffectivePlan(state, auth.user.id, new Date());
    const packs = getAvailablePacks(plan);

    safeLogInfo("Policy vault packs listed", {
      user_id: auth.user.id,
      plan,
      pack_count: packs.length
    });

    return {
      ok: true,
      packs,
      plan,
      evaluated_at: new Date().toISOString()
    };
  });

  // ── Single pack detail ────────────────────────────────────────────────

  function buildOverlaySummary(
    state: StoreState, userId: string
  ): { overlayObj: Record<string, unknown> | null; overrideFields: number } {
    const rec = findOverlay(state, userId);
    if (!rec) return { overlayObj: null, overrideFields: 0 };
    const overlayObj = {
      scope_type: rec.scope_type, scope_id: rec.scope_id,
      plan: rec.plan,
      overrides: rec.overrides as Record<string, Record<string, unknown>>,
      updated_at: rec.updated_at
    };
    return { overlayObj, overrideFields: countOverrideFields(overlayObj) };
  }

  app.get<{ Params: { domain: string } }>("/account/policy/vault/pack/:domain", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return;
    const domain = request.params.domain as PolicyDomain;
    if (!ALL_POLICY_DOMAINS.includes(domain)) return reply.status(400).send({ ok: false, error: "Unknown policy domain: " + domain, known_domains: ALL_POLICY_DOMAINS });
    const state = store.snapshot();
    const plan = resolveEffectivePlan(state, auth.user.id, new Date()).plan;
    const pack = getPackDetail(domain, plan);
    if (!pack) return reply.status(403).send({ ok: false, error: "Policy pack not available for plan: " + plan });
    safeLogInfo("Policy vault pack detail", { user_id: auth.user.id, domain, plan, version: pack.version });
    const overlay = buildOverlaySummary(state, auth.user.id);
    return { ok: true, pack, plan, tenant_overlay_active: !!(overlay.overlayObj as any)?.overrides?.[domain], tenant_override_fields: overlay.overrideFields, evaluated_at: new Date().toISOString() };
  });

  // ── Admin: resolved pack with thresholds (debug/audit) ─────────────

  app.get<{ Params: { domain: string }; Querystring: { plan?: string } }>(
    `${adminRoutePrefix}/board/policy/vault/resolve/:domain`,
    async (request, reply) => {
      const admin = await requireAdminPermission(request, reply, adminPermissionKeys.BOARD_READ);
      if (!admin) return;
      const domain = request.params.domain as PolicyDomain;
      if (!ALL_POLICY_DOMAINS.includes(domain)) { reply.status(400); return { ok: false, error: "Unknown policy domain: " + domain, known_domains: ALL_POLICY_DOMAINS }; }
      const plan = (request.query.plan as PlanTier) || "enterprise";
      const resolved = resolvePolicyPack(domain, plan, null);
      safeLogInfo("Admin policy vault resolve", { admin_email: admin.userEmail, domain, plan, version: resolved.version });
      return { ok: true, resolved };
    }
  );

  // ── Admin: all pack versions (overview) ───────────────────────────────

  app.get(
    `${adminRoutePrefix}/board/policy/vault/versions`,
    async (request, reply) => {
      const admin = await requireAdminPermission(
        request,
        reply,
        adminPermissionKeys.BOARD_READ
      );
      if (!admin) return;

      const versions = ALL_POLICY_DOMAINS.map((d) => ({
        domain: d,
        version: getPolicyPackVersion(d)
      }));

      return { ok: true, versions, evaluated_at: new Date().toISOString() };
    }
  );

  // ── Tenant overlay CRUD ───────────────────────────────────────────────

  function findOverlay(
    state: StoreState,
    userId: string
  ): PolicyTenantOverlayRecord | undefined {
    return state.policy_tenant_overlays.find(
      (o) => o.scope_type === "user" && o.scope_id === userId
    );
  }

  app.get("/account/policy/vault/overlay", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return;
    const { overlayObj, overrideFields } = buildOverlaySummary(store.snapshot(), auth.user.id);
    return { ok: true, overlay: overlayObj, override_fields: overrideFields };
  });

  app.put<{
    Body: { overrides?: Record<string, unknown> };
  }>("/account/policy/vault/overlay", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return;
    const rawOverrides = request.body?.overrides;
    if (!rawOverrides || typeof rawOverrides !== "object") {
      reply.status(400);
      return { ok: false, error: "Missing or invalid 'overrides' object." };
    }
    const state = store.snapshot();
    const { plan } = resolveEffectivePlan(state, auth.user.id, new Date());
    const built = buildTenantOverlay("user", auth.user.id, plan, rawOverrides);
    await upsertOverlayRecord(auth.user.id, built);
    safeLogInfo("Tenant overlay saved", { user_id: auth.user.id, plan, override_fields: countOverrideFields(built) });
    return {
      ok: true,
      overlay: { scope_type: built.scope_type, scope_id: built.scope_id, plan: built.plan, overrides: built.overrides, updated_at: built.updated_at },
      override_fields: countOverrideFields(built)
    };
  });

  type OL = ReturnType<typeof buildTenantOverlay>;
  async function upsertOverlayRecord(userId: string, built: OL): Promise<void> {
    await store.update((s) => {
      const idx = s.policy_tenant_overlays.findIndex((o) => o.scope_type === "user" && o.scope_id === userId);
      const record: PolicyTenantOverlayRecord = {
        id: idx >= 0 ? s.policy_tenant_overlays[idx].id : randomUUID(),
        scope_type: built.scope_type, scope_id: built.scope_id, plan: built.plan,
        overrides: built.overrides as Record<string, Record<string, unknown>>,
        updated_at: built.updated_at,
        created_at: idx >= 0 ? s.policy_tenant_overlays[idx].created_at : new Date().toISOString()
      };
      if (idx >= 0) { s.policy_tenant_overlays[idx] = record; } else { s.policy_tenant_overlays.push(record); }
    });
  }

  app.delete("/account/policy/vault/overlay", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) return;

    let deleted = false;
    await store.update((s) => {
      const idx = s.policy_tenant_overlays.findIndex(
        (o) => o.scope_type === "user" && o.scope_id === auth.user.id
      );
      if (idx >= 0) {
        s.policy_tenant_overlays.splice(idx, 1);
        deleted = true;
      }
    });

    safeLogInfo("Tenant overlay deleted", {
      user_id: auth.user.id,
      deleted
    });

    return { ok: true, deleted };
  });
}
