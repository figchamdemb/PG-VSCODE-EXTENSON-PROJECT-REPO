/**
 * Offline Pack Routes
 * Milestone 13F – Enterprise offline encrypted rule pack.
 *
 * Enterprise-only endpoints for activating, downloading, and
 * inspecting machine-bound encrypted offline rule packs (.yrp).
 *
 * Routes:
 *  POST /account/enterprise/offline-pack/activate
 *  GET  /account/enterprise/offline-pack/info
 *  POST {admin}/board/enterprise/offline-pack/issue
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import { ENTITLEMENT_MATRIX } from "./entitlementMatrix";
import { encryptOfflinePack, generateLicenseKey } from "./offlinePackCrypto";
import type { PolicyDomain } from "./policyVaultTypes";
import type { PlanTier, StoreState } from "./types";
import type {
  AdminOfflinePackIssueRequest,
  OfflinePackActivationRequest,
  OfflinePackMetadata,
  OfflineRule,
  OfflineRulePackPayload
} from "./offlinePackTypes";
import { DEFAULT_PACK_TTL_DAYS } from "./offlinePackTypes";

// ── In-memory issued-pack ledger (production: move to DB) ───────────────

const issuedPacks = new Map<string, OfflinePackMetadata>();

// ── Deps ────────────────────────────────────────────────────────────────

type AuthResult = { user: { id: string } };

type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

export type RegisterOfflinePackRoutesDeps = {
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => AuthResult | undefined;
  store: { snapshot: () => StoreState };
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
  /** Per-domain version tags from the policy pack registry. */
  packVersions: Record<PolicyDomain, string>;
  safeLogInfo: (msg: string, ctx?: Record<string, unknown>) => void;
  safeLogWarn: (msg: string, ctx?: Record<string, unknown>) => void;
  toErrorMessage: (e: unknown) => string;
};

// ── Route registration ──────────────────────────────────────────────────

export function registerOfflinePackRoutes(
  app: FastifyInstance,
  deps: RegisterOfflinePackRoutesDeps
): void {
  // ── POST /account/enterprise/offline-pack/activate ──────────────────
  app.post<{ Body: OfflinePackActivationRequest }>(
    "/account/enterprise/offline-pack/activate",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }
      return handleActivation(auth.user.id, request.body, deps, reply);
    }
  );

  // ── GET /account/enterprise/offline-pack/info ───────────────────────
  app.get(
    "/account/enterprise/offline-pack/info",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }
      return handleInfo(auth.user.id, reply);
    }
  );

  // ── POST {admin}/board/enterprise/offline-pack/issue ────────────────
  const adminPrefix = deps.adminRoutePrefix;
  app.post<{ Body: AdminOfflinePackIssueRequest }>(
    `${adminPrefix}/board/enterprise/offline-pack/issue`,
    async (request, reply) => {
      const ctx = await deps.requireAdminPermission(
        request,
        reply,
        deps.adminPermissionKeys.BOARD_READ
      );
      if (!ctx) {
        return;
      }
      return handleAdminIssue(request.body, deps, reply);
    }
  );

  // ── POST /account/enterprise/offline-pack/rotate ────────────────────
  app.post<{ Body: { pack_id: string; license_key: string; machine_id: string } }>(
    "/account/enterprise/offline-pack/rotate",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) return;
      return handleRotation(auth.user.id, request.body, deps, reply);
    }
  );

  // ── POST {admin}/board/enterprise/offline-pack/revoke ───────────────
  app.post<{ Body: { pack_id: string } }>(
    `${adminPrefix}/board/enterprise/offline-pack/revoke`,
    async (request, reply) => {
      const ctx = await deps.requireAdminPermission(
        request,
        reply,
        deps.adminPermissionKeys.BOARD_READ
      );
      if (!ctx) return;
      return handleRevoke(request.body, deps, reply);
    }
  );
}

// ── Handlers (kept ≤ 40 lines each per COD-FUNC-001) ───────────────────

async function handleActivation(
  userId: string,
  body: OfflinePackActivationRequest,
  deps: RegisterOfflinePackRoutesDeps,
  reply: FastifyReply
): Promise<unknown> {
  const { license_key, machine_id } = body ?? {};
  if (!license_key || !machine_id) {
    return reply
      .status(400)
      .send({ ok: false, error: "Missing license_key or machine_id", code: "INVALID_LICENSE" });
  }

  const state = deps.store.snapshot();
  const { plan } = deps.resolveEffectivePlan(state, userId, new Date());

  if (plan !== "enterprise") {
    return reply
      .status(403)
      .send({ ok: false, error: "Offline packs require an enterprise plan.", code: "NOT_ENTERPRISE" });
  }

  try {
    const meta = buildAndIssuePack(userId, machine_id, license_key, deps);
    deps.safeLogInfo("Offline pack activated", {
      user_id: userId,
      pack_id: meta.pack_id,
      machine_id
    });

    const packed = encryptAndSerialize(meta, license_key, machine_id, deps);
    return reply
      .header("x-pg-pack-id", meta.pack_id)
      .header("x-pg-pack-version", meta.version)
      .header("x-pg-pack-expires", meta.expires_at)
      .type("application/octet-stream")
      .send(packed);
  } catch (err) {
    deps.safeLogWarn("Offline pack activation failed", {
      user_id: userId,
      error: deps.toErrorMessage(err)
    });
    return reply
      .status(500)
      .send({ ok: false, error: "Pack generation failed.", code: "SERVER_ERROR" });
  }
}

async function handleInfo(
  userId: string,
  reply: FastifyReply
): Promise<unknown> {
  const userPacks = Array.from(issuedPacks.values())
    .filter((p) => p.user_id === userId);
  if (userPacks.length === 0) {
    return reply.status(404).send({ ok: false, error: "No offline packs found." });
  }
  const latest = userPacks.sort(
    (a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
  )[0];
  latest.is_expired = new Date(latest.expires_at) < new Date();
  return { ok: true, meta: latest };
}

async function handleAdminIssue(
  body: AdminOfflinePackIssueRequest,
  deps: RegisterOfflinePackRoutesDeps,
  reply: FastifyReply
): Promise<unknown> {
  const { user_id, machine_id, ttl_days } = body ?? {};
  if (!user_id || !machine_id) {
    return reply
      .status(400)
      .send({ ok: false, error: "Missing user_id or machine_id." });
  }

  const state = deps.store.snapshot();
  const { plan } = deps.resolveEffectivePlan(state, user_id, new Date());
  if (plan !== "enterprise") {
    return reply
      .status(403)
      .send({ ok: false, error: "Target user is not on enterprise plan." });
  }

  const licenseKey = generateLicenseKey();
  const meta = buildAndIssuePack(
    user_id,
    machine_id,
    licenseKey,
    deps,
    ttl_days
  );
  deps.safeLogInfo("Admin issued offline pack", {
    user_id,
    pack_id: meta.pack_id
  });
  return { ok: true, meta, license_key: licenseKey };
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function handleRotation(
  userId: string,
  body: { pack_id: string; license_key: string; machine_id: string },
  deps: RegisterOfflinePackRoutesDeps,
  reply: FastifyReply
): Promise<unknown> {
  const { pack_id, license_key, machine_id } = body ?? {};
  if (!pack_id || !license_key || !machine_id) {
    return reply
      .status(400)
      .send({ ok: false, error: "Missing pack_id, license_key, or machine_id." });
  }

  const existing = issuedPacks.get(pack_id);
  if (!existing || existing.user_id !== userId) {
    return reply.status(404).send({ ok: false, error: "Pack not found." });
  }

  // Revoke old pack
  existing.is_expired = true;

  // Issue fresh pack
  const meta = buildAndIssuePack(userId, machine_id, license_key, deps);
  deps.safeLogInfo("Offline pack rotated", {
    user_id: userId,
    old_pack_id: pack_id,
    new_pack_id: meta.pack_id,
    machine_id
  });

  const packed = encryptAndSerialize(meta, license_key, machine_id, deps);
  return reply
    .header("x-pg-pack-id", meta.pack_id)
    .header("x-pg-pack-version", meta.version)
    .header("x-pg-pack-expires", meta.expires_at)
    .type("application/octet-stream")
    .send(packed);
}

async function handleRevoke(
  body: { pack_id: string },
  deps: RegisterOfflinePackRoutesDeps,
  reply: FastifyReply
): Promise<unknown> {
  const { pack_id } = body ?? {};
  if (!pack_id) {
    return reply.status(400).send({ ok: false, error: "Missing pack_id." });
  }
  const existing = issuedPacks.get(pack_id);
  if (!existing) {
    return reply.status(404).send({ ok: false, error: "Pack not found." });
  }
  existing.is_expired = true;
  deps.safeLogInfo("Offline pack revoked", { pack_id });
  return { ok: true, pack_id, status: "revoked" };
}

function buildAndIssuePack(
  userId: string,
  machineId: string,
  _licenseKey: string,
  deps: RegisterOfflinePackRoutesDeps,
  ttlDays: number = DEFAULT_PACK_TTL_DAYS
): OfflinePackMetadata {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000);
  const entitlements = ENTITLEMENT_MATRIX.enterprise;
  const domains = entitlements.policy_domains;
  const domainVersions: Record<string, string> = {};
  for (const d of domains) {
    domainVersions[d] = deps.packVersions[d] ?? "unknown";
  }

  const meta: OfflinePackMetadata = {
    pack_id: randomUUID(),
    user_id: userId,
    machine_id: machineId,
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    version: "1.0.0",
    plan: "enterprise",
    domains: [...domains],
    domain_versions: domainVersions,
    is_expired: false
  };
  issuedPacks.set(meta.pack_id, meta);
  return meta;
}

function encryptAndSerialize(
  meta: OfflinePackMetadata,
  licenseKey: string,
  machineId: string,
  deps: RegisterOfflinePackRoutesDeps
): Buffer {
  const rules = buildPlaceholderRules(meta.domains);
  const payload: OfflineRulePackPayload = {
    pack_id: meta.pack_id,
    version: meta.version,
    issued_at: meta.issued_at,
    expires_at: meta.expires_at,
    plan: meta.plan,
    domains: meta.domains,
    domain_versions: meta.domain_versions,
    thresholds: buildDefaultThresholds(meta.domains),
    scoring_weights: buildDefaultWeights(meta.domains),
    severity_overrides: {},
    rules
  };
  return encryptOfflinePack(payload, licenseKey, machineId);
}

function buildPlaceholderRules(domains: PolicyDomain[]): OfflineRule[] {
  return domains.map((d) => ({
    ruleId: `${d}-offline-001`,
    domain: d,
    severity: "warning" as const,
    title: `Offline ${d} baseline rule`,
    description: `Baseline ${d} check for offline enterprise environments.`,
    recommendation: `Review ${d} results and apply fixes.`
  }));
}

function buildDefaultThresholds(
  domains: PolicyDomain[]
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const d of domains) {
    out[d] = {};
  }
  return out;
}

function buildDefaultWeights(
  domains: PolicyDomain[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of domains) {
    out[d] = 1.0;
  }
  return out;
}
