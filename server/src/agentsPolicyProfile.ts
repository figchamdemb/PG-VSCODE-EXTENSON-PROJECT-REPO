/**
 * AGENTS Policy Profile — Server-side plan-aware agent directives resolver.
 *
 * AGENTS.md stays as the local repo-level workflow instructions.
 * This module provides the server-private, plan-tier-aware profile that
 * controls which policies an AI agent must enforce, strictness levels,
 * auto-fix capabilities, and production gate requirements.
 *
 * Routes:
 *  GET  /account/policy/agents/profile        – user agent profile
 *  GET  {admin}/board/policy/agents/profile    – admin cross-scope profile
 *
 * Registered as a sub-route in policyRoutes.ts.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PlanTier, StoreState } from "./types";
import type { PolicyDomain, PolicyTenantOverlay } from "./policyVaultTypes";
import { ENTITLEMENT_MATRIX } from "./entitlementMatrix";
import { ALL_POLICY_DOMAINS } from "./policyPackRegistry";

// ── Agent profile types ─────────────────────────────────────────────────

export interface AgentDomainDirective {
  domain: PolicyDomain;
  enforcement: "warn" | "block" | "off";
  auto_fix: boolean;
  required_for_prod_checklist: boolean;
}

export interface AgentProfile {
  ok: true;
  plan: PlanTier;
  profile_version: string;
  /** Domains this plan is entitled to use */
  available_domains: PolicyDomain[];
  /** Per-domain directives for the agent */
  directives: AgentDomainDirective[];
  /** Global agent behaviour flags */
  behaviour: {
    memory_bank_required: boolean;
    self_check_on_batch: boolean;
    self_check_strict_on_complete: boolean;
    file_line_limit: number;
    production_checklist_required: boolean;
    offline_pack_supported: boolean;
    frontend_design_guardrails_required: boolean;
    frontend_design_default_reference: string;
    frontend_design_reference_surfaces: string[];
    frontend_design_target_platforms: string[];
    user_design_guide_precedence: boolean;
    design_similarity_mode: "similar-not-copy";
    major_surface_consistency_required: boolean;
    frontend_design_native_translation_required: boolean;
    frontend_design_mobile_pattern_examples_required: boolean;
    frontend_design_button_pattern_grammar_required: boolean;
  };
  evaluated_at: string;
}

// ── Profile version (bump when directives schema changes) ───────────────

const PROFILE_VERSION = "1.2.0";

// ── Enforcement level by plan tier ──────────────────────────────────────

const ENFORCEMENT_BY_TIER: Record<PlanTier, "warn" | "block"> = {
  free: "warn",
  trial: "warn",
  pro: "block",
  team: "block",
  enterprise: "block"
};

const AUTO_FIX_TIERS: Set<PlanTier> = new Set(["pro", "team", "enterprise"]);

const PROD_CHECKLIST_TIERS: Set<PlanTier> = new Set(["team", "enterprise"]);

const OFFLINE_PACK_TIERS: Set<PlanTier> = new Set(["enterprise"]);

// ── Profile resolver ────────────────────────────────────────────────────

export function resolveAgentProfile(
  plan: PlanTier,
  overlay?: PolicyTenantOverlay | null
): AgentProfile {
  const matrix = ENTITLEMENT_MATRIX[plan];
  const availableDomains = matrix?.policy_domains ?? ALL_POLICY_DOMAINS;
  const enforcement = ENFORCEMENT_BY_TIER[plan] ?? "warn";
  const autoFix = AUTO_FIX_TIERS.has(plan);
  const prodChecklist = PROD_CHECKLIST_TIERS.has(plan);
  const offlinePack = OFFLINE_PACK_TIERS.has(plan);

  // Build per-domain directives
  const directives: AgentDomainDirective[] = ALL_POLICY_DOMAINS.map((d) => {
    const entitled = availableDomains.includes(d);
    // Overlay can override enforcement per domain
    const domainOverride = overlay?.overrides?.[d] as
      | { enforcement?: "warn" | "block" | "off"; auto_fix?: boolean }
      | undefined;

    return {
      domain: d,
      enforcement: !entitled
        ? ("off" as const)
        : domainOverride?.enforcement ?? enforcement,
      auto_fix: entitled && (domainOverride?.auto_fix ?? autoFix),
      required_for_prod_checklist: entitled && prodChecklist
    };
  });

  return {
    ok: true,
    plan,
    profile_version: PROFILE_VERSION,
    available_domains: availableDomains,
    directives,
    behaviour: {
      memory_bank_required: true,
      self_check_on_batch: true,
      self_check_strict_on_complete: plan !== "free",
      file_line_limit: 500,
      production_checklist_required: prodChecklist,
      offline_pack_supported: offlinePack,
      frontend_design_guardrails_required: true,
      frontend_design_default_reference: "docs/FRONTEND_DESIGN_GUARDRAILS.md",
      frontend_design_reference_surfaces: [
        "docs/FRONTEND_DESIGN_GUARDRAILS.md",
        "server/public/app.html",
        "server/public/assets/site.css",
        "server/public/assets/app.css",
        "server/public/help.html",
        "server/public/assets/help.css",
        "server/public/pricing.html",
        "server/public/assets/pricing.css"
      ],
      frontend_design_target_platforms: [
        "web",
        "react-web",
        "react-native",
        "android-compose"
      ],
      user_design_guide_precedence: true,
      design_similarity_mode: "similar-not-copy",
      major_surface_consistency_required: true,
      frontend_design_native_translation_required: true,
      frontend_design_mobile_pattern_examples_required: true,
      frontend_design_button_pattern_grammar_required: true
    },
    evaluated_at: new Date().toISOString()
  };
}

// ── Deps ────────────────────────────────────────────────────────────────

type AuthResult = { user: { id: string } };
type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

export interface RegisterAgentsProfileRoutesDeps {
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => AuthResult | undefined;
  store: {
    snapshot: () => StoreState;
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

// ── Overlay helper ──────────────────────────────────────────────────────

function lookupOverlay(
  state: StoreState,
  userId: string
): PolicyTenantOverlay | null {
  const rec = state.policy_tenant_overlays.find(
    (o) => o.scope_type === "user" && o.scope_id === userId
  );
  if (!rec) return null;
  return {
    scope_type: rec.scope_type,
    scope_id: rec.scope_id,
    plan: rec.plan,
    overrides: rec.overrides as Record<string, Record<string, unknown>>,
    updated_at: rec.updated_at
  };
}

// ── Route registration ──────────────────────────────────────────────────

export function registerAgentsProfileRoutes(
  app: FastifyInstance,
  deps: RegisterAgentsProfileRoutesDeps
): void {
  // ── User agent profile ────────────────────────────────────────────────

  app.get("/account/policy/agents/profile", async (request, reply) => {
    const auth = deps.requireAuth(request, reply);
    if (!auth) return;

    const state = deps.store.snapshot();
    const { plan } = deps.resolveEffectivePlan(state, auth.user.id, new Date());
    const overlay = lookupOverlay(state, auth.user.id);

    const profile = resolveAgentProfile(plan, overlay);

    deps.safeLogInfo("Agent profile resolved", {
      user_id: auth.user.id,
      plan,
      domains: profile.available_domains.length,
      directives: profile.directives.length
    });

    return profile;
  });

  // ── Admin cross-scope profile ─────────────────────────────────────────

  app.get<{ Querystring: { target_user_id?: string } }>(
    `${deps.adminRoutePrefix}/board/policy/agents/profile`,
    async (request, reply) => {
      const admin = await deps.requireAdminPermission(
        request,
        reply,
        deps.adminPermissionKeys.BOARD_READ
      );
      if (!admin) return;

      const state = deps.store.snapshot();
      const targetUserId = request.query.target_user_id ?? "";
      const { plan } = targetUserId
        ? deps.resolveEffectivePlan(state, targetUserId, new Date())
        : { plan: "enterprise" as PlanTier };
      const overlay = targetUserId ? lookupOverlay(state, targetUserId) : null;

      const profile = resolveAgentProfile(plan, overlay);

      deps.safeLogInfo("Admin agent profile resolved", {
        admin_email: admin.userEmail,
        target_user_id: targetUserId || "default-enterprise",
        plan,
        domains: profile.available_domains.length
      });

      return profile;
    }
  );
}
