import "dotenv/config";
import * as path from "path";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { PrismaStateStore } from "./prismaStore";
import { JsonStore, StateStore } from "./store";
import { PLAN_RULES } from "./rules";
import {
  ModuleScope,
  PlanTier,
  PaidPlanTier,
  ProductEntitlementRecord,
  ProjectQuotaRecord,
  SessionRecord,
  StoreState,
  SubscriptionRecord,
  UserRecord
} from "./types";

const PORT = Number(process.env.PORT ?? "8787");
const HOST = process.env.HOST ?? "127.0.0.1";
const ADMIN_KEY = process.env.ADMIN_KEY ?? "dev-admin-key";
const SESSION_TTL_HOURS = 24 * 30;
const TRIAL_DURATION_HOURS = 48;
const REFUND_WINDOW_DAYS = 7;
const OFFLINE_REF_TTL_DAYS = 7;
const DEFAULT_AFFILIATE_RATE_BPS = 1000;
const OAUTH_STATE_TTL_MINUTES = 10;
const GITHUB_CLIENT_ID = (process.env.GITHUB_CLIENT_ID ?? "").trim();
const GITHUB_CLIENT_SECRET = (process.env.GITHUB_CLIENT_SECRET ?? "").trim();
const GITHUB_REDIRECT_URI =
  (process.env.GITHUB_REDIRECT_URI ?? `http://${HOST}:${PORT}/auth/github/callback`).trim();
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
const GOOGLE_REDIRECT_URI =
  (process.env.GOOGLE_REDIRECT_URI ?? `http://${HOST}:${PORT}/auth/google/callback`).trim();
const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
const STRIPE_PRICE_MAP_RAW = (process.env.STRIPE_PRICE_MAP ?? "").trim();
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? `http://${HOST}:${PORT}`).trim();
const OAUTH_CALLBACK_ORIGINS = parseOriginList(
  process.env.OAUTH_CALLBACK_ORIGINS,
  PUBLIC_BASE_URL
);
const ENABLE_EMAIL_OTP = parseBooleanEnv(process.env.ENABLE_EMAIL_OTP, true);
const EXPOSE_DEV_OTP_CODE = parseBooleanEnv(process.env.EXPOSE_DEV_OTP_CODE, true);
const SUPER_ADMIN_EMAILS = parseEmailAllowList(process.env.SUPER_ADMIN_EMAILS);
const SUPER_ADMIN_SOURCE = parseSuperAdminSource(process.env.SUPER_ADMIN_SOURCE);
const ADMIN_AUTH_MODE = parseAdminAuthMode(process.env.ADMIN_AUTH_MODE);
const ADMIN_RBAC_BOOTSTRAP = parseBooleanEnv(process.env.ADMIN_RBAC_BOOTSTRAP, true);
const ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS = parseEmailAllowList(
  process.env.ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS ?? process.env.SUPER_ADMIN_EMAILS
);
const SESSION_COOKIE_NAME = (process.env.SESSION_COOKIE_NAME ?? "pg_session").trim() || "pg_session";
const SESSION_COOKIE_SECURE = parseBooleanEnv(process.env.SESSION_COOKIE_SECURE, false);
const SESSION_COOKIE_SAME_SITE = parseCookieSameSite(process.env.SESSION_COOKIE_SAMESITE, "lax");
const AUTH_START_RATE_LIMIT_MAX = parsePositiveInt(process.env.AUTH_START_RATE_LIMIT_MAX, 20);
const AUTH_START_RATE_LIMIT_WINDOW =
  (process.env.AUTH_START_RATE_LIMIT_WINDOW ?? "1 hour").trim() || "1 hour";
const AUTH_VERIFY_RATE_LIMIT_MAX = parsePositiveInt(process.env.AUTH_VERIFY_RATE_LIMIT_MAX, 5);
const AUTH_VERIFY_RATE_LIMIT_WINDOW =
  (process.env.AUTH_VERIFY_RATE_LIMIT_WINDOW ?? "5 hours").trim() || "5 hours";
const ADMIN_ROUTE_PREFIX = normalizeAdminRoutePrefix(process.env.ADMIN_ROUTE_PREFIX);
const GOVERNANCE_ALLOW_PRO = parseBooleanEnv(process.env.GOVERNANCE_ALLOW_PRO, false);
const GOVERNANCE_DEFAULT_RETENTION_DAYS = clampInt(
  parsePositiveInt(process.env.GOVERNANCE_DEFAULT_RETENTION_DAYS, 7),
  1,
  90
);
const GOVERNANCE_MIN_RETENTION_DAYS = 1;
const GOVERNANCE_MAX_RETENTION_DAYS = 90;
const GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS = clampInt(
  parsePositiveInt(process.env.GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS, 4000),
  500,
  16000
);
const GOVERNANCE_MIN_DEBATE_CHARS = 500;
const GOVERNANCE_MAX_DEBATE_CHARS = 16000;
const GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS = parsePositiveInt(
  process.env.GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS,
  2500
);
const STORE_BACKEND = parseStoreBackend(process.env.STORE_BACKEND);
const SLACK_COMMANDS_ENABLED = parseBooleanEnv(process.env.SLACK_COMMANDS_ENABLED, false);
const SLACK_SIGNING_SECRET = (process.env.SLACK_SIGNING_SECRET ?? "").trim();
const SLACK_BOT_TOKEN = (process.env.SLACK_BOT_TOKEN ?? "").trim();
const SLACK_WEBHOOK_URL = (process.env.SLACK_WEBHOOK_URL ?? "").trim();
const SLACK_ALLOWED_TEAM_IDS = parseStringAllowList(process.env.SLACK_ALLOWED_TEAM_IDS);
const SLACK_ALLOWED_EMAILS = parseEmailAllowList(process.env.SLACK_ALLOWED_EMAILS);
const SLACK_REQUEST_MAX_AGE_SECONDS = clampInt(
  parsePositiveInt(process.env.SLACK_REQUEST_MAX_AGE_SECONDS, 300),
  30,
  900
);
const CLOUDFLARE_ACCESS_ENABLED = parseBooleanEnv(process.env.CLOUDFLARE_ACCESS_ENABLED, false);
const CLOUDFLARE_ACCESS_TEAM_DOMAIN = (process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN ?? "")
  .trim()
  .toLowerCase();
const CLOUDFLARE_ACCESS_AUD = (process.env.CLOUDFLARE_ACCESS_AUD ?? "").trim();
const CLOUDFLARE_ACCESS_JWKS_TTL_SECONDS = clampInt(
  parsePositiveInt(process.env.CLOUDFLARE_ACCESS_JWKS_TTL_SECONDS, 600),
  60,
  3600
);
const ADMIN_PERMISSION_KEYS = {
  BOARD_READ: "board.read",
  BOARD_SUPPORT_WRITE: "board.support.write",
  BOARD_SUBSCRIPTION_WRITE: "board.subscription.write",
  BOARD_SESSION_REVOKE: "board.session.revoke",
  REFUND_APPROVE: "refund.approve",
  SUBSCRIPTION_GRANT: "subscription.grant",
  TEAM_MANAGE: "team.manage",
  PROVIDER_POLICY_MANAGE: "provider_policy.manage",
  OFFLINE_PAYMENT_REVIEW: "offline.review",
  AFFILIATE_MANAGE: "affiliate.manage"
} as const;
const CHECKOUT_SUCCESS_URL =
  (process.env.CHECKOUT_SUCCESS_URL ?? `${PUBLIC_BASE_URL}/checkout/success`).trim();
const CHECKOUT_CANCEL_URL =
  (process.env.CHECKOUT_CANCEL_URL ?? `${PUBLIC_BASE_URL}/checkout/cancel`).trim();
const STORE_PATH = process.env.STORE_PATH
  ? path.resolve(process.env.STORE_PATH)
  : path.resolve(process.cwd(), "data", "store.json");
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const DATABASE_TARGET = describeDatabaseTarget(process.env.DATABASE_URL);

const STRIPE_PRICE_MAP = parseStripePriceMap(STRIPE_PRICE_MAP_RAW);
type StoreBackend = "json" | "prisma";
type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[keyof typeof ADMIN_PERMISSION_KEYS];
type AdminAuthMode = "key" | "db" | "hybrid";
type SlackCommandAction = "help" | "summary" | "eod" | "thread" | "vote" | "decide";
type SlackEphemeralResponse = {
  response_type: "ephemeral";
  text: string;
  blocks?: Array<Record<string, unknown>>;
  replace_original?: boolean;
};

const app = Fastify({ logger: true, trustProxy: true });
const prisma = new PrismaClient();
const store: StateStore =
  STORE_BACKEND === "prisma" ? new PrismaStateStore(prisma) : new JsonStore(STORE_PATH);

let cloudflareCertCache:
  | {
      fetchedAtMs: number;
      certByKid: Map<string, string>;
    }
  | null = null;

interface AdminAccessContext {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
}

interface EntitlementClaimPayload {
  sub: string;
  install_id: string;
  plan: PlanTier;
  features: {
    edu_view: boolean;
    export: boolean;
    change_report: boolean;
    memorybank: boolean;
  };
  modules: Array<"narrate" | "memorybank" | "bundle">;
  projects_allowed: number;
  projects_used: number;
  trial_expires_at: string | null;
  refund_window_ends_at: string | null;
  token_max_ttl_hours: number;
  provider_policy: {
    local_only: boolean;
    byo_allowed: boolean;
    allowlist: string[];
    denylist: string[];
  };
  iat: number;
  exp: number;
}

async function bootstrap(): Promise<void> {
  app.log.info({ database_target: DATABASE_TARGET }, "Database target resolved");
  await store.initialize();
  app.log.info({ store_backend: STORE_BACKEND }, "Store initialized");
  if (ADMIN_RBAC_BOOTSTRAP) {
    try {
      await ensureAdminRbacBaseline();
    } catch (error) {
      app.log.warn({ error: toErrorMessage(error) }, "Admin RBAC bootstrap failed");
    }
  }
  await app.register(cookie);
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    global: false,
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true
    }
  });
  await app.register(fastifyStatic, {
    root: PUBLIC_DIR,
    prefix: "/"
  });
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      try {
        const trimmed = typeof body === "string" ? body.trim() : "";
        if (!trimmed) {
          done(null, {});
          return;
        }
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
          (parsed as Record<string, unknown>).__raw_json_body = body;
          done(null, parsed);
          return;
        }
        done(null, {
          value: parsed,
          __raw_json_body: body
        });
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  );
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      const raw = typeof body === "string" ? body : "";
      const params = new URLSearchParams(raw);
      const parsed: Record<string, unknown> = { __raw_form_body: raw };
      for (const [key, value] of params.entries()) {
        const existing = parsed[key];
        if (existing === undefined) {
          parsed[key] = value;
          continue;
        }
        if (Array.isArray(existing)) {
          existing.push(value);
          continue;
        }
        parsed[key] = [existing, value];
      }
      done(null, parsed);
    }
  );
  if (CLOUDFLARE_ACCESS_ENABLED && (!CLOUDFLARE_ACCESS_TEAM_DOMAIN || !CLOUDFLARE_ACCESS_AUD)) {
    app.log.warn(
      "Cloudflare Access is enabled but CLOUDFLARE_ACCESS_TEAM_DOMAIN or CLOUDFLARE_ACCESS_AUD is missing."
    );
  }
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "same-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    return payload;
  });
  registerRoutes();
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Narrate licensing server started on http://${HOST}:${PORT}`);
}

function registerRoutes(): void {
  app.get("/", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").sendFile("index.html");
  });
  app.get("/terms", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").sendFile("terms.html");
  });
  app.get("/privacy", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").sendFile("privacy.html");
  });
  app.get("/checkout/success", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").sendFile("checkout-success.html");
  });
  app.get("/checkout/cancel", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").sendFile("checkout-cancel.html");
  });
  app.get("/oauth/github/complete", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").sendFile("oauth-complete.html");
  });
  app.get("/oauth/google/complete", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").sendFile("oauth-complete.html");
  });
  app.get("/app", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").sendFile("app.html");
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/integrations/slack/health", async () => {
    return {
      ok: true,
      commands_enabled: SLACK_COMMANDS_ENABLED,
      has_signing_secret: Boolean(SLACK_SIGNING_SECRET),
      has_bot_token: Boolean(SLACK_BOT_TOKEN),
      has_webhook_url: Boolean(SLACK_WEBHOOK_URL),
      team_allowlist_enabled: SLACK_ALLOWED_TEAM_IDS.size > 0,
      email_allowlist_enabled: SLACK_ALLOWED_EMAILS.size > 0
    };
  });

  app.post<{
    Body: Record<string, unknown> & { __raw_form_body?: string };
  }>("/integrations/slack/commands", async (request, reply) => {
    if (!SLACK_COMMANDS_ENABLED) {
      return reply.code(503).send({
        response_type: "ephemeral",
        text: "Slack commands are disabled on this server."
      });
    }
    if (!SLACK_SIGNING_SECRET) {
      return reply.code(503).send({
        response_type: "ephemeral",
        text: "Slack signing secret is not configured."
      });
    }
    const rawBody = typeof request.body?.__raw_form_body === "string" ? request.body.__raw_form_body : "";
    if (!verifySlackRequestSignature(request, rawBody, SLACK_SIGNING_SECRET)) {
      return reply.code(401).send({ response_type: "ephemeral", text: "Invalid Slack signature." });
    }

    const teamId = getStringLikeValue(request.body, "team_id");
    if (SLACK_ALLOWED_TEAM_IDS.size > 0 && (!teamId || !SLACK_ALLOWED_TEAM_IDS.has(teamId))) {
      return reply.code(403).send({ response_type: "ephemeral", text: "Slack workspace is not allowed." });
    }

    const text = getStringLikeValue(request.body, "text") ?? "";
    if (isSlackHelpCommand(text)) {
      return reply.send({
        response_type: "ephemeral",
        text: buildSlackHelpText()
      });
    }

    const responseUrl = getStringLikeValue(request.body, "response_url");
    const slackUserId = getStringLikeValue(request.body, "user_id");
    if (!slackUserId) {
      return reply.code(400).send({ response_type: "ephemeral", text: "Slack user id is missing." });
    }

    if (responseUrl) {
      reply.send({
        response_type: "ephemeral",
        text: "Processing command..."
      });
      void processSlackCommandAsync(responseUrl, slackUserId, text);
      return;
    }

    const userEmail = await resolveSlackUserEmail(slackUserId);
    if (!userEmail) {
      return reply.send({
        response_type: "ephemeral",
        text: "Could not resolve your Slack email. Ensure Slack bot scope includes `users:read.email`."
      });
    }
    if (SLACK_ALLOWED_EMAILS.size > 0 && !SLACK_ALLOWED_EMAILS.has(userEmail)) {
      return reply.code(403).send({
        response_type: "ephemeral",
        text: `Email ${userEmail} is not authorized for Slack governance commands.`
      });
    }

    const user = await getOrCreateUserByEmail(userEmail);
    const result = await executeSlackGovernanceCommand(user, text);
    return reply.send(result);
  });

  app.post<{
    Body: Record<string, unknown> & { __raw_form_body?: string };
  }>("/integrations/slack/actions", async (request, reply) => {
    if (!SLACK_COMMANDS_ENABLED) {
      return reply.code(503).send({ text: "Slack actions are disabled on this server." });
    }
    if (!SLACK_SIGNING_SECRET) {
      return reply.code(503).send({ text: "Slack signing secret is not configured." });
    }
    const rawBody = typeof request.body?.__raw_form_body === "string" ? request.body.__raw_form_body : "";
    if (!verifySlackRequestSignature(request, rawBody, SLACK_SIGNING_SECRET)) {
      return reply.code(401).send({ text: "Invalid Slack signature." });
    }

    const payloadRaw = getStringLikeValue(request.body, "payload");
    if (!payloadRaw) {
      return reply.code(400).send({ text: "Missing Slack action payload." });
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(payloadRaw) as Record<string, unknown>;
    } catch {
      return reply.code(400).send({ text: "Invalid Slack action payload JSON." });
    }

    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    if (actions.length === 0 || typeof actions[0] !== "object" || !actions[0]) {
      return reply.code(400).send({ text: "No Slack action found." });
    }
    const action = actions[0] as Record<string, unknown>;
    const actionId = typeof action.action_id === "string" ? action.action_id.trim() : "";
    if (!actionId) {
      return reply.code(400).send({ text: "Invalid Slack action id." });
    }

    const responseUrl = getString(payload, "response_url") ?? null;
    reply.send({
      response_type: "ephemeral",
      text: "Processing action..."
    });
    void processSlackActionAsync(responseUrl, payload, actionId, action);
    return;
  });

  app.get("/catalog/plans", async () => {
    return {
      plans: [
        {
          id: "free",
          billing_period: "none",
          features: PLAN_RULES.free,
          governance: {
            enabled: false,
            slack_addon_available: false
          }
        },
        {
          id: "trial",
          billing_period: "48h",
          features: PLAN_RULES.trial,
          governance: {
            enabled: false,
            slack_addon_available: false
          }
        },
        {
          id: "pro",
          billing_period: "annual",
          features: PLAN_RULES.pro,
          governance: {
            enabled: GOVERNANCE_ALLOW_PRO,
            slack_addon_available: GOVERNANCE_ALLOW_PRO
          }
        },
        {
          id: "team",
          billing_period: "annual",
          features: PLAN_RULES.team,
          governance: {
            enabled: true,
            slack_addon_available: true
          }
        },
        {
          id: "enterprise",
          billing_period: "annual",
          features: PLAN_RULES.enterprise,
          governance: {
            enabled: true,
            slack_addon_available: true
          }
        }
      ],
      add_ons: [
        {
          id: "slack_governance_bridge",
          label: "Slack Governance Bridge",
          billing: "per-seat-month",
          price_cents_per_seat_month: GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS,
          enabled_for_plans: GOVERNANCE_ALLOW_PRO
            ? ["pro", "team", "enterprise"]
            : ["team", "enterprise"]
        }
      ]
    };
  });

  app.get("/catalog/modules", async () => {
    return {
      modules: [
        { id: "narrate", label: "Narrate module" },
        { id: "memorybank", label: "PG Memory Bank module" },
        { id: "bundle", label: "Narrate + Memory Bank bundle" }
      ]
    };
  });

  app.get<{
    Querystring: { install_id?: string; callback_url?: string };
  }>(
    "/auth/github/start",
    {
      config: {
        rateLimit: {
          max: AUTH_START_RATE_LIMIT_MAX,
          timeWindow: AUTH_START_RATE_LIMIT_WINDOW
        }
      }
    },
    async (request, reply) => {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return reply.code(503).send({ error: "GitHub OAuth is not configured on this server." });
    }

    const installId = request.query?.install_id?.trim() || null;
    const callbackUrl = request.query?.callback_url?.trim() || null;
    if (callbackUrl && !isAllowedOAuthCallbackUrl(callbackUrl)) {
      return reply.code(400).send({ error: "callback_url is not in trusted OAuth callback origins." });
    }

    const stateToken = randomBytes(24).toString("hex");
    await store.update((state) => {
      state.oauth_states.push({
        id: randomUUID(),
        state: stateToken,
        provider: "github",
        install_id: installId,
        callback_url: callbackUrl,
        created_at: new Date().toISOString(),
        expires_at: addMinutes(new Date(), OAUTH_STATE_TTL_MINUTES).toISOString(),
        consumed_at: null
      });
    });

    const githubAuthorizeUrl = new URL("https://github.com/login/oauth/authorize");
    githubAuthorizeUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
    githubAuthorizeUrl.searchParams.set("redirect_uri", GITHUB_REDIRECT_URI);
    githubAuthorizeUrl.searchParams.set("scope", "read:user user:email");
    githubAuthorizeUrl.searchParams.set("state", stateToken);
    return reply.redirect(githubAuthorizeUrl.toString());
    }
  );

  app.get<{
    Querystring: { state?: string; code?: string; error?: string; error_description?: string };
  }>("/auth/github/callback", async (request, reply) => {
    const stateValue = request.query?.state?.trim();
    const code = request.query?.code?.trim();
    const oauthError = request.query?.error?.trim();
    const oauthErrorDescription = request.query?.error_description?.trim();
    if (!stateValue) {
      return reply.code(400).send({ error: "state is required" });
    }

    const stateRecord = await consumeOAuthState("github", stateValue);
    if (!stateRecord) {
      return reply.code(400).send({ error: "oauth state is invalid or expired" });
    }

    if (oauthError) {
      return replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: oauthErrorDescription || oauthError
      });
    }
    if (!code) {
      return replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: "Missing OAuth code."
      });
    }

    try {
      const githubToken = await exchangeGitHubOAuthCode(code, stateValue);
      const profile = await fetchGitHubProfile(githubToken);
      const email = await resolveGitHubPrimaryEmail(githubToken, profile.email);
      if (!email) {
        return replyAfterOAuth(stateRecord.callback_url, reply, {
          status: "error",
          message: "GitHub account does not provide a verified email."
        });
      }

      const user = await getOrCreateUserByEmail(email);
      const sessionToken = randomBytes(32).toString("hex");
      await store.update((storeState) => {
        const effectivePlan = resolveEffectivePlan(storeState, user.id, new Date());
        const deviceLimit = PLAN_RULES[effectivePlan.plan].device_limit;
        storeState.sessions.push({
          token: sessionToken,
          user_id: user.id,
          created_at: new Date().toISOString(),
          expires_at: addHours(new Date(), SESSION_TTL_HOURS).toISOString()
        });
        ensureDeviceRecord(
          storeState,
          user.id,
          stateRecord.install_id || "github-oauth",
          "github-oauth",
          deviceLimit
        );
      });
      setSessionCookie(reply, request, sessionToken);

      return replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "ok",
        access_token: sessionToken,
        expires_in_sec: SESSION_TTL_HOURS * 3600,
        user_id: user.id
      });
    } catch (error) {
      return replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: toErrorMessage(error)
      });
    }
  });

  app.get<{
    Querystring: { install_id?: string; callback_url?: string };
  }>(
    "/auth/google/start",
    {
      config: {
        rateLimit: {
          max: AUTH_START_RATE_LIMIT_MAX,
          timeWindow: AUTH_START_RATE_LIMIT_WINDOW
        }
      }
    },
    async (request, reply) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return reply.code(503).send({ error: "Google OAuth is not configured on this server." });
    }

    const installId = request.query?.install_id?.trim() || null;
    const callbackUrl = request.query?.callback_url?.trim() || null;
    if (callbackUrl && !isAllowedOAuthCallbackUrl(callbackUrl)) {
      return reply.code(400).send({ error: "callback_url is not in trusted OAuth callback origins." });
    }

    const stateToken = randomBytes(24).toString("hex");
    await store.update((state) => {
      state.oauth_states.push({
        id: randomUUID(),
        state: stateToken,
        provider: "google",
        install_id: installId,
        callback_url: callbackUrl,
        created_at: new Date().toISOString(),
        expires_at: addMinutes(new Date(), OAUTH_STATE_TTL_MINUTES).toISOString(),
        consumed_at: null
      });
    });

    const googleAuthorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthorizeUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    googleAuthorizeUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
    googleAuthorizeUrl.searchParams.set("response_type", "code");
    googleAuthorizeUrl.searchParams.set("scope", "openid email profile");
    googleAuthorizeUrl.searchParams.set("access_type", "offline");
    googleAuthorizeUrl.searchParams.set("prompt", "consent");
    googleAuthorizeUrl.searchParams.set("state", stateToken);
    return reply.redirect(googleAuthorizeUrl.toString());
    }
  );

  app.get<{
    Querystring: { state?: string; code?: string; error?: string; error_description?: string };
  }>("/auth/google/callback", async (request, reply) => {
    const stateValue = request.query?.state?.trim();
    const code = request.query?.code?.trim();
    const oauthError = request.query?.error?.trim();
    const oauthErrorDescription = request.query?.error_description?.trim();
    if (!stateValue) {
      return reply.code(400).send({ error: "state is required" });
    }

    const stateRecord = await consumeOAuthState("google", stateValue);
    if (!stateRecord) {
      return reply.code(400).send({ error: "oauth state is invalid or expired" });
    }

    if (oauthError) {
      return replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: oauthErrorDescription || oauthError
      });
    }
    if (!code) {
      return replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: "Missing OAuth code."
      });
    }

    try {
      const googleToken = await exchangeGoogleOAuthCode(code);
      const googleProfile = await fetchGoogleProfile(googleToken);
      const email = normalizeEmail(googleProfile.email);
      if (!email) {
        return replyAfterOAuth(stateRecord.callback_url, reply, {
          status: "error",
          message: "Google account did not return an email."
        });
      }
      if (googleProfile.email_verified !== true) {
        return replyAfterOAuth(stateRecord.callback_url, reply, {
          status: "error",
          message: "Google account email is not verified."
        });
      }

      const user = await getOrCreateUserByEmail(email);
      const sessionToken = randomBytes(32).toString("hex");
      await store.update((storeState) => {
        const effectivePlan = resolveEffectivePlan(storeState, user.id, new Date());
        const deviceLimit = PLAN_RULES[effectivePlan.plan].device_limit;
        storeState.sessions.push({
          token: sessionToken,
          user_id: user.id,
          created_at: new Date().toISOString(),
          expires_at: addHours(new Date(), SESSION_TTL_HOURS).toISOString()
        });
        ensureDeviceRecord(
          storeState,
          user.id,
          stateRecord.install_id || "google-oauth",
          "google-oauth",
          deviceLimit
        );
      });
      setSessionCookie(reply, request, sessionToken);

      return replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "ok",
        access_token: sessionToken,
        expires_in_sec: SESSION_TTL_HOURS * 3600,
        user_id: user.id
      });
    } catch (error) {
      return replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: toErrorMessage(error)
      });
    }
  });

  app.get("/entitlement/public-key", async () => {
    const snapshot = store.snapshot();
    return {
      alg: snapshot.keys.alg,
      public_key_pem: snapshot.keys.public_key_pem
    };
  });

  app.post<{ Body: { email?: string } }>(
    "/auth/email/start",
    {
      config: {
        rateLimit: {
          max: AUTH_START_RATE_LIMIT_MAX,
          timeWindow: AUTH_START_RATE_LIMIT_WINDOW
        }
      }
    },
    async (request, reply) => {
    if (!ENABLE_EMAIL_OTP) {
      return reply.code(403).send({ error: "email OTP sign-in is disabled" });
    }
    const email = normalizeEmail(request.body?.email);
    if (!email) {
      return reply.code(400).send({ error: "email is required" });
    }
    const code = `${Math.floor(100000 + Math.random() * 900000)}`;
    const expiresAt = addHours(new Date(), 0.25).toISOString();
    await store.update((state) => {
      state.auth_challenges = state.auth_challenges.filter((item) => item.email !== email);
      state.auth_challenges.push({
        id: randomUUID(),
        email,
        code,
        created_at: new Date().toISOString(),
        expires_at: expiresAt
      });
    });
    const response: {
      status: "code_sent";
      email: string;
      expires_at: string;
      dev_code?: string;
    } = {
      status: "code_sent",
      email,
      expires_at: expiresAt
    };
    if (EXPOSE_DEV_OTP_CODE) {
      response.dev_code = code;
    }
    return response;
    }
  );

  app.post<{
    Body: { email?: string; code?: string; install_id?: string };
  }>(
    "/auth/email/verify",
    {
      config: {
        rateLimit: {
          max: AUTH_VERIFY_RATE_LIMIT_MAX,
          timeWindow: AUTH_VERIFY_RATE_LIMIT_WINDOW
        }
      }
    },
    async (request, reply) => {
    if (!ENABLE_EMAIL_OTP) {
      return reply.code(403).send({ error: "email OTP sign-in is disabled" });
    }
    const email = normalizeEmail(request.body?.email);
    const code = request.body?.code?.trim();
    const installId = request.body?.install_id?.trim();

    if (!email || !code || !installId) {
      return reply.code(400).send({ error: "email, code and install_id are required" });
    }

    const snapshot = store.snapshot();
    const challenge = snapshot.auth_challenges.find((item) => item.email === email);
    if (!challenge) {
      return reply.code(400).send({ error: "verification code not found" });
    }
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      return reply.code(400).send({ error: "verification code expired" });
    }
    if (challenge.code !== code) {
      return reply.code(401).send({ error: "invalid verification code" });
    }

    let userId = snapshot.users.find((item) => item.email === email)?.id;
    const nowIso = new Date().toISOString();
    if (!userId) {
      userId = randomUUID();
      const createdUserId = userId;
      await store.update((state) => {
        state.users.push({
          id: createdUserId,
          email,
          created_at: nowIso,
          last_login_at: nowIso
        });
      });
    } else {
      await store.update((state) => {
        const user = state.users.find((item) => item.id === userId);
        if (user) {
          user.last_login_at = nowIso;
        }
      });
    }

    const finalUserId = userId;
    const sessionToken = randomBytes(32).toString("hex");
    try {
      await store.update((state) => {
        const effectivePlan = resolveEffectivePlan(state, finalUserId as string, new Date());
        const deviceLimit = PLAN_RULES[effectivePlan.plan].device_limit;
        state.auth_challenges = state.auth_challenges.filter((item) => item.email !== email);
        state.sessions.push({
          token: sessionToken,
          user_id: finalUserId as string,
          created_at: nowIso,
          expires_at: addHours(new Date(), SESSION_TTL_HOURS).toISOString()
        });
        ensureDeviceRecord(state, finalUserId as string, installId, "auth-verify", deviceLimit);
      });
    } catch (error) {
      const message = toErrorMessage(error);
      if (message === "device limit reached" || message === "device revoked") {
        return reply.code(403).send({ error: message });
      }
      throw error;
    }

    setSessionCookie(reply, request, sessionToken);

    return {
      access_token: sessionToken,
      expires_in_sec: SESSION_TTL_HOURS * 3600,
      user_id: finalUserId
    };
    }
  );

  app.post("/auth/session/signout", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization) || getSessionTokenFromCookie(request);
    const nowIso = new Date().toISOString();
    if (token) {
      await store.update((state) => {
        const session = state.sessions.find((item) => item.token === token);
        if (session) {
          session.expires_at = nowIso;
        }
      });
    }
    clearSessionCookie(reply, request);
    return { ok: true };
  });

  app.post("/trial/start", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const snapshot = store.snapshot();
    const existing = snapshot.trials.find((item) => item.user_id === auth.user.id);
    if (existing) {
      return reply.code(409).send({
        error: "trial already claimed for this account",
        trial_expires_at: existing.trial_expires_at
      });
    }

    const now = new Date();
    const trialExpires = addHours(now, TRIAL_DURATION_HOURS).toISOString();
    await store.update((state) => {
      state.trials.push({
        user_id: auth.user.id,
        trial_started_at: now.toISOString(),
        trial_expires_at: trialExpires
      });
    });

    return { trial_expires_at: trialExpires };
  });

  app.post<{
    Body: { install_id?: string; device_label?: string };
  }>("/entitlement/activate", async (request, reply) => {
    return issueEntitlement(request, reply, "activate");
  });

  app.post<{
    Body: { install_id?: string; device_label?: string };
  }>("/entitlement/refresh", async (request, reply) => {
    return issueEntitlement(request, reply, "refresh");
  });

  app.get("/entitlement/status", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const snapshot = store.snapshot();
    const activeDevice = snapshot.devices.find(
      (item) => item.user_id === auth.user.id && item.revoked_at === null
    );
    const installId = activeDevice?.install_id ?? "status-view";
    const claims = buildEntitlementClaims(snapshot, auth.user.id, installId);
    const token = signEntitlementToken(snapshot, claims);
    return {
      entitlement_token: token,
      expires_at: new Date(claims.exp * 1000).toISOString(),
      claims
    };
  });

  app.post("/devices/list", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const snapshot = store.snapshot();
    const devices = snapshot.devices.filter((item) => item.user_id === auth.user.id);
    return { devices };
  });

  app.post<{ Body: { device_id?: string } }>("/devices/revoke", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const deviceId = request.body?.device_id?.trim();
    if (!deviceId) {
      return reply.code(400).send({ error: "device_id is required" });
    }
    await store.update((state) => {
      const device = state.devices.find(
        (item) => item.user_id === auth.user.id && item.id === deviceId
      );
      if (!device) {
        throw new Error("device not found");
      }
      device.revoked_at = new Date().toISOString();
      device.last_seen_at = new Date().toISOString();
    });
    return { ok: true };
  });

  app.post<{
    Body: { scope?: "memorybank"; repo_fingerprint?: string; repo_label?: string };
  }>("/projects/activate", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const scope = request.body?.scope;
    const repoFingerprint = request.body?.repo_fingerprint?.trim();
    const repoLabel = request.body?.repo_label?.trim() ?? null;
    if (scope !== "memorybank" || !repoFingerprint) {
      return reply.code(400).send({ error: "scope=memorybank and repo_fingerprint are required" });
    }

    const snapshot = store.snapshot();
    const claimTemplate = buildEntitlementClaims(snapshot, auth.user.id, "project-activation");
    if (!claimTemplate.features.memorybank) {
      return reply.code(403).send({ error: "memorybank entitlement is not enabled" });
    }

    let idempotent = false;
    let quotaAfter: ProjectQuotaRecord | undefined;
    await store.update((state) => {
      const existing = state.project_activations.find(
        (item) =>
          item.user_id === auth.user.id &&
          item.scope === "memorybank" &&
          item.repo_fingerprint === repoFingerprint
      );
      const quota = ensureQuotaRecord(state, auth.user.id, claimTemplate.plan);

      if (existing) {
        existing.last_seen_at = new Date().toISOString();
        idempotent = true;
        quotaAfter = quota;
        return;
      }

      if (quota.projects_used >= quota.projects_allowed) {
        throw new Error("project quota exceeded");
      }

      state.project_activations.push({
        id: randomUUID(),
        user_id: auth.user.id,
        scope: "memorybank",
        repo_fingerprint: repoFingerprint,
        repo_label: repoLabel,
        first_activated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      });
      quota.projects_used += 1;
      quota.updated_at = new Date().toISOString();
      quotaAfter = quota;
    });

    if (!quotaAfter) {
      return reply.code(500).send({ error: "quota update failed" });
    }

    return {
      scope: "memorybank",
      idempotent,
      projects_allowed: quotaAfter.projects_allowed,
      projects_used: quotaAfter.projects_used,
      projects_remaining: Math.max(0, quotaAfter.projects_allowed - quotaAfter.projects_used)
    };
  });

  app.get<{ Querystring: { scope?: "memorybank" } }>("/projects/quota", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const scope = request.query?.scope ?? "memorybank";
    if (scope !== "memorybank") {
      return reply.code(400).send({ error: "only memorybank scope is supported in milestone 5" });
    }

    const snapshot = store.snapshot();
    const claimTemplate = buildEntitlementClaims(snapshot, auth.user.id, "quota-view");
    const quota = ensureQuotaRecord(snapshot, auth.user.id, claimTemplate.plan);
    return {
      scope,
      projects_allowed: quota.projects_allowed,
      projects_used: quota.projects_used,
      projects_remaining: Math.max(0, quota.projects_allowed - quota.projects_used)
    };
  });

  app.post<{ Body: { reason?: string } }>("/refund/request", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const snapshot = store.snapshot();
    const activeSub = snapshot.subscriptions.find(
      (item) => item.user_id === auth.user.id && item.status === "active"
    );
    if (!activeSub) {
      return reply.code(400).send({ error: "no active subscription found" });
    }
    if (new Date(activeSub.refund_window_ends_at).getTime() < Date.now()) {
      return reply.code(400).send({ error: "refund window already closed" });
    }

    const requestId = randomUUID();
    await store.update((state) => {
      state.refund_requests.push({
        id: requestId,
        user_id: auth.user.id,
        subscription_id: activeSub.id,
        requested_at: new Date().toISOString(),
        status: "requested",
        approved_at: null,
        reason: request.body?.reason?.trim() || null
      });
    });
    return { request_id: requestId, status: "requested" };
  });

  app.get("/account/summary", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const snapshot = store.snapshot();
    const now = new Date();
    const claims = buildEntitlementClaims(snapshot, auth.user.id, "account-summary");
    const planState = resolveEffectivePlan(snapshot, auth.user.id, now);
    const quota = ensureQuotaRecord(snapshot, auth.user.id, claims.plan);
    const userSubscriptions = snapshot.subscriptions
      .filter((item) => item.user_id === auth.user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const userRefundRequests = snapshot.refund_requests
      .filter((item) => item.user_id === auth.user.id)
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at));
    const activeMemberships = snapshot.team_memberships.filter(
      (item) => item.user_id === auth.user.id && item.status === "active" && item.revoked_at === null
    );

    const teams = activeMemberships
      .map((membership) => {
        const team = snapshot.teams.find((item) => item.id === membership.team_id);
        if (!team) {
          return null;
        }
        const seatsUsed = snapshot.team_memberships.filter(
          (item) => item.team_id === team.id && item.status === "active"
        ).length;
        return {
          team_key: team.team_key,
          plan_id: team.plan_id,
          module_scope: team.module_scope,
          role: membership.role,
          seat_limit: team.seat_limit,
          seats_used: seatsUsed,
          seats_remaining: Math.max(0, team.seat_limit - seatsUsed)
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const activeSubscription = userSubscriptions.find((item) => item.status === "active") ?? null;
    const latestTrial =
      snapshot.trials
        .filter((item) => item.user_id === auth.user.id)
        .sort((a, b) => b.trial_started_at.localeCompare(a.trial_started_at))[0] ?? null;
    const activeRefundRequest =
      userRefundRequests.find((item) => item.status === "requested") ?? null;
    const superAdminEmails = await getSuperAdminEmailSet();
    let adminAccess: Awaited<ReturnType<typeof resolveAdminAccessFromDb>> | null = null;
    try {
      adminAccess = await resolveAdminAccessFromDb(auth.user.email);
    } catch (error) {
      app.log.warn({ error: toErrorMessage(error) }, "Failed to resolve admin access for account summary");
    }
    const canAccessAdminBoard =
      superAdminEmails.has(auth.user.email) ||
      Boolean(
        adminAccess?.isSuperAdmin || adminAccess?.permissions.has(ADMIN_PERMISSION_KEYS.BOARD_READ)
      );
    const governanceTeamScopes = teams
      .filter((team) => supportsGovernancePlan(team.plan_id as PlanTier))
      .map((team) => ({
        team_key: team.team_key,
        plan_id: team.plan_id,
        can_manage: canManageTeamRole(team.role)
      }));

    return {
      ok: true,
      account: {
        user_id: auth.user.id,
        email: auth.user.email,
        created_at: auth.user.created_at,
        last_login_at: auth.user.last_login_at
      },
      plan: claims.plan,
      features: claims.features,
      modules: claims.modules,
      quota: {
        projects_allowed: quota.projects_allowed,
        projects_used: quota.projects_used,
        projects_remaining: Math.max(0, quota.projects_allowed - quota.projects_used)
      },
      trial: latestTrial
        ? {
            started_at: latestTrial.trial_started_at,
            expires_at: latestTrial.trial_expires_at,
            is_active: new Date(latestTrial.trial_expires_at).getTime() > now.getTime()
          }
        : null,
      subscription: activeSubscription
        ? {
            id: activeSubscription.id,
            plan_id: activeSubscription.plan_id,
            status: activeSubscription.status,
            source: activeSubscription.source,
            starts_at: activeSubscription.starts_at,
            ends_at: activeSubscription.ends_at,
            refund_window_ends_at: activeSubscription.refund_window_ends_at,
            team_id: activeSubscription.team_id
          }
        : null,
      renewal: activeSubscription ? { next_due_at: activeSubscription.ends_at } : null,
      is_super_admin: superAdminEmails.has(auth.user.email),
      can_access_admin_board: canAccessAdminBoard,
      admin_route_prefix: canAccessAdminBoard ? ADMIN_ROUTE_PREFIX : null,
      admin_cloudflare_access_enabled: CLOUDFLARE_ACCESS_ENABLED,
      admin_permissions: adminAccess ? Array.from(adminAccess.permissions).sort() : [],
      governance: {
        enabled: supportsGovernancePlan(claims.plan) || governanceTeamScopes.length > 0,
        current_plan_supported: supportsGovernancePlan(claims.plan),
        team_scopes: governanceTeamScopes,
        slack_addon_seat_price_cents_per_month: GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS
      },
      refund: {
        active_request: activeRefundRequest,
        can_request:
          planState.subscription !== undefined &&
          new Date(planState.subscription.refund_window_ends_at).getTime() > now.getTime()
      },
      teams,
      can_manage_team: teams.some((item) => canManageTeamRole(item.role))
    };
  });

  app.get("/account/billing/history", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const snapshot = store.snapshot();
    const subscriptions = snapshot.subscriptions
      .filter((item) => item.user_id === auth.user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const refunds = snapshot.refund_requests
      .filter((item) => item.user_id === auth.user.id)
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at));
    const offlineRefs = snapshot.offline_payment_refs
      .filter((item) => item.email === auth.user.email)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    return {
      ok: true,
      email: auth.user.email,
      subscriptions,
      refund_requests: refunds,
      offline_references: offlineRefs
    };
  });

  app.get("/account/support/history", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const snapshot = store.snapshot();
    const tickets = snapshot.support_tickets
      .filter((item) => item.user_id === auth.user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { ok: true, tickets };
  });

  app.post<{
    Body: {
      category?: "support" | "billing" | "bug" | "feature";
      severity?: "low" | "medium" | "high";
      subject?: string;
      message?: string;
    };
  }>("/account/support/request", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const category = normalizeSupportCategory(request.body?.category);
    const severity = normalizeSupportSeverity(request.body?.severity);
    const subject = request.body?.subject?.trim();
    const message = request.body?.message?.trim();
    if (!subject || !message || !category || !severity) {
      return reply.code(400).send({
        error: "category, severity, subject, and message are required"
      });
    }
    if (subject.length > 160 || message.length > 4000) {
      return reply.code(400).send({
        error: "subject or message is too long"
      });
    }

    const ticketId = randomUUID();
    const nowIso = new Date().toISOString();
    await store.update((state) => {
      state.support_tickets.push({
        id: ticketId,
        user_id: auth.user.id,
        email: auth.user.email,
        category,
        severity,
        subject,
        message,
        status: "open",
        resolution_note: null,
        created_at: nowIso,
        updated_at: nowIso
      });
    });

    return { ok: true, ticket_id: ticketId, status: "open" };
  });

  app.post<{
    Body: { rating?: number; message?: string };
  }>("/account/feedback", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const rating = Math.floor(request.body?.rating ?? 0);
    const message = request.body?.message?.trim() || null;
    if (rating < 1 || rating > 5) {
      return reply.code(400).send({ error: "rating must be between 1 and 5" });
    }
    if (message && message.length > 1200) {
      return reply.code(400).send({ error: "feedback message is too long" });
    }

    const feedbackId = randomUUID();
    await store.update((state) => {
      state.feedback_entries.push({
        id: feedbackId,
        user_id: auth.user.id,
        email: auth.user.email,
        rating: rating as 1 | 2 | 3 | 4 | 5,
        message,
        created_at: new Date().toISOString()
      });
    });

    return { ok: true, feedback_id: feedbackId };
  });

  app.post<{
    Body: {
      team_key?: string;
      plan_id?: "team" | "enterprise";
      module_scope?: ModuleScope;
      seat_limit?: number;
      years?: number;
    };
  }>("/account/team/create", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const planId = request.body?.plan_id ?? "team";
    const moduleScope = request.body?.module_scope ?? "bundle";
    const seatLimit = Math.max(1, Math.floor(request.body?.seat_limit ?? 5));
    const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
    const requestedTeamKey = request.body?.team_key?.trim().toUpperCase();
    const teamKey = requestedTeamKey || `TEAM-${randomBytes(3).toString("hex").toUpperCase()}`;
    let teamId = "";
    try {
      await store.update((state) => {
        if (state.teams.some((item) => item.team_key === teamKey)) {
          throw new Error("team_key already exists");
        }

        teamId = randomUUID();
        state.teams.push({
          id: teamId,
          team_key: teamKey,
          owner_user_id: auth.user.id,
          plan_id: planId,
          module_scope: moduleScope,
          seat_limit: seatLimit,
          created_at: new Date().toISOString()
        });
        state.team_memberships.push({
          id: randomUUID(),
          team_id: teamId,
          user_id: auth.user.id,
          role: "owner",
          status: "active",
          invited_email: auth.user.email,
          created_at: new Date().toISOString(),
          revoked_at: null
        });
      });
    } catch (error) {
      return reply.code(409).send({ error: toErrorMessage(error) });
    }

    const grant = await grantSubscriptionByUserId({
      userId: auth.user.id,
      planId,
      moduleScope,
      years,
      source: "manual",
      teamId
    });

    return {
      ok: true,
      team_key: teamKey,
      owner_email: auth.user.email,
      seat_limit: seatLimit,
      plan_id: planId,
      module_scope: moduleScope,
      ends_at: grant.endsAt
    };
  });

  app.get<{
    Querystring: { team_key?: string };
  }>("/account/team/status", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.query?.team_key?.trim().toUpperCase();
    const snapshot = store.snapshot();
    const access = resolveTeamAccessForUser(snapshot, auth.user.id, teamKey, false);
    if (!access) {
      return reply.code(404).send({ error: "team not found for this account" });
    }

    return {
      ok: true,
      membership_role: access.membership.role,
      can_manage: canManageTeamRole(access.membership.role),
      ...buildTeamStatusPayload(snapshot, access.team)
    };
  });

  app.post<{
    Body: {
      team_key?: string;
      email?: string;
      role?: "manager" | "member";
      years?: number;
    };
  }>("/account/team/assign-seat", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const email = normalizeEmail(request.body?.email);
    const role = request.body?.role ?? "member";
    const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
    if (!email) {
      return reply.code(400).send({ error: "email is required" });
    }

    const snapshot = store.snapshot();
    const access = resolveTeamAccessForUser(snapshot, auth.user.id, teamKey, true);
    if (!access) {
      return reply.code(403).send({ error: "you do not have team management access" });
    }

    const team = access.team;
    const user = await getOrCreateUserByEmail(email);
    const activeSeats = snapshot.team_memberships.filter(
      (item) => item.team_id === team.id && item.status === "active"
    ).length;
    const existingActive = snapshot.team_memberships.find(
      (item) => item.team_id === team.id && item.user_id === user.id && item.status === "active"
    );
    if (!existingActive && activeSeats >= team.seat_limit) {
      return reply.code(403).send({ error: "team seat limit reached" });
    }

    await store.update((state) => {
      const membership = state.team_memberships.find(
        (item) => item.team_id === team.id && item.user_id === user.id
      );
      if (membership) {
        membership.status = "active";
        membership.revoked_at = null;
        membership.role = role;
        membership.invited_email = email;
      } else {
        state.team_memberships.push({
          id: randomUUID(),
          team_id: team.id,
          user_id: user.id,
          role,
          status: "active",
          invited_email: email,
          created_at: new Date().toISOString(),
          revoked_at: null
        });
      }
    });

    const grant = await grantSubscriptionByUserId({
      userId: user.id,
      planId: team.plan_id,
      moduleScope: team.module_scope,
      years,
      source: "manual",
      teamId: team.id
    });

    return { ok: true, team_key: team.team_key, email, role, ends_at: grant.endsAt };
  });

  app.post<{
    Body: { team_key?: string; email?: string };
  }>("/account/team/revoke-seat", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const email = normalizeEmail(request.body?.email);
    if (!email) {
      return reply.code(400).send({ error: "email is required" });
    }

    const snapshot = store.snapshot();
    const access = resolveTeamAccessForUser(snapshot, auth.user.id, teamKey, true);
    if (!access) {
      return reply.code(403).send({ error: "you do not have team management access" });
    }
    const user = snapshot.users.find((item) => item.email === email);
    if (!user) {
      return reply.code(404).send({ error: "user not found" });
    }

    try {
      await store.update((state) => {
        const membership = state.team_memberships.find(
          (item) =>
            item.team_id === access.team.id &&
            item.user_id === user.id &&
            item.status === "active"
        );
        if (!membership) {
          throw new Error("active membership not found");
        }
        if (membership.role === "owner") {
          throw new Error("owner seat cannot be revoked via self-service");
        }

        membership.status = "revoked";
        membership.revoked_at = new Date().toISOString();

        for (const sub of state.subscriptions) {
          if (
            sub.user_id === user.id &&
            sub.team_id === access.team.id &&
            sub.status === "active"
          ) {
            sub.status = "revoked";
            sub.revoked_at = new Date().toISOString();
          }
        }
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return { ok: true, team_key: access.team.team_key, email };
  });

  app.post<{
    Body: {
      team_key?: string;
      local_only?: boolean;
      byo_allowed?: boolean;
      allowlist?: string[];
      denylist?: string[];
    };
  }>("/account/team/provider-policy/set", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const snapshot = store.snapshot();
    const access = resolveTeamAccessForUser(snapshot, auth.user.id, teamKey, true);
    if (!access) {
      return reply.code(403).send({ error: "you do not have team management access" });
    }

    const policy = normalizePolicyInput(request.body);
    await upsertProviderPolicy("team", access.team.id, policy);
    return { ok: true, team_key: access.team.team_key, policy };
  });

  app.get<{
    Querystring: { team_key?: string };
  }>("/account/governance/settings", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const teamKey = request.query?.team_key?.trim().toUpperCase() || undefined;
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({
        error:
          "governance settings are available for team/enterprise plans (or pro when enabled), and team access is required"
      });
    }

    const settings =
      getGovernanceSettingsForScope(snapshot, context.scopeType, context.scopeId) ??
      buildDefaultGovernanceSettings(context.scopeType, context.scopeId, new Date().toISOString());
    return {
      ok: true,
      scope_type: context.scopeType,
      scope_id: context.scopeId,
      team_key: context.team?.team_key ?? null,
      plan: context.plan,
      can_manage: context.canManage,
      settings,
      add_on_catalog: {
        slack_bridge: {
          available: true,
          addon_active: settings.slack_addon_active,
          seat_price_cents_per_month: GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS
        }
      }
    };
  });

  app.post<{
    Body: {
      team_key?: string;
      slack_enabled?: boolean;
      slack_channel?: string | null;
      vote_mode?: "majority" | "single_reviewer";
      retention_days?: number;
      max_debate_chars?: number;
    };
  }>("/account/governance/settings/update", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase() || undefined;
    const currentSnapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(
      currentSnapshot,
      auth.user.id,
      teamKey,
      Boolean(teamKey)
    );
    if (!context) {
      return reply.code(403).send({
        error:
          "you do not have access to governance settings for this scope, or the plan does not include governance"
      });
    }

    let settingsResult: StoreState["governance_settings"][number] | null = null;
    try {
      await store.update((state) => {
        const liveContext = resolveGovernanceContextForUser(
          state,
          auth.user.id,
          teamKey,
          Boolean(teamKey)
        );
        if (!liveContext || !liveContext.canManage) {
          throw new Error("governance settings require owner/manager access");
        }
        settingsResult = upsertGovernanceSettings(
          state,
          liveContext.scopeType,
          liveContext.scopeId,
          {
            slack_enabled: request.body?.slack_enabled,
            slack_channel: request.body?.slack_channel,
            vote_mode: normalizeGovernanceVoteMode(request.body?.vote_mode),
            retention_days: request.body?.retention_days,
            max_debate_chars: request.body?.max_debate_chars
          }
        );
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return {
      ok: true,
      scope_type: context.scopeType,
      scope_id: context.scopeId,
      team_key: context.team?.team_key ?? null,
      settings: settingsResult
    };
  });

  app.post<{
    Body: { team_key?: string; message?: string };
  }>("/account/governance/slack/test", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const message = request.body?.message?.trim();
    if (!message) {
      return reply.code(400).send({ error: "message is required" });
    }
    if (message.length > 1000) {
      return reply.code(400).send({ error: "message is too long" });
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase() || undefined;
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({ error: "governance context not found for this account/scope" });
    }
    const settings =
      getGovernanceSettingsForScope(snapshot, context.scopeType, context.scopeId) ??
      buildDefaultGovernanceSettings(context.scopeType, context.scopeId, new Date().toISOString());
    if (!settings.slack_enabled || !settings.slack_addon_active) {
      return reply.code(400).send({
        error: "Slack dispatch is disabled for this scope. Enable slack and add-on first."
      });
    }
    try {
      await dispatchSlackGovernanceNotification(
        settings,
        `*PG Slack test message*\nFrom: ${auth.user.email}\nScope: ${
          context.team?.team_key ?? "personal"
        }\nMessage: ${message}`
      );
    } catch (error) {
      return reply.code(502).send({ error: `Slack dispatch failed: ${toErrorMessage(error)}` });
    }
    return { ok: true, dispatched: true, team_key: context.team?.team_key ?? null };
  });

  app.post<{
    Body: {
      team_key?: string;
      title?: string;
      summary?: string;
      work_started_at?: string | null;
      work_ended_at?: string | null;
      changed_files?: string[];
      blockers?: string[];
      source?: "agent" | "human";
      agent_name?: string | null;
    };
  }>("/account/governance/eod/report", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const title = request.body?.title?.trim();
    const summary = request.body?.summary?.trim();
    if (!title || !summary) {
      return reply.code(400).send({ error: "title and summary are required" });
    }
    if (title.length > 180 || summary.length > 12000) {
      return reply.code(400).send({ error: "title or summary is too long" });
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase() || undefined;
    const changedFiles = normalizeStringList(request.body?.changed_files, 120, 260);
    const blockers = normalizeStringList(request.body?.blockers, 40, 300);
    const source = request.body?.source === "agent" ? "agent" : "human";
    const agentName = request.body?.agent_name?.trim() || null;
    if (agentName && agentName.length > 80) {
      return reply.code(400).send({ error: "agent_name is too long" });
    }

    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({
        error:
          "EOD governance reports are available for team/enterprise plans (or pro when enabled), and team access is required"
      });
    }

    const reportId = randomUUID();
    try {
      await store.update((state) => {
        const liveContext = resolveGovernanceContextForUser(state, auth.user.id, teamKey, false);
        if (!liveContext) {
          throw new Error("governance context was not found");
        }
        const nowIso = new Date().toISOString();
        state.governance_eod_reports.push({
          id: reportId,
          user_id: auth.user.id,
          email: auth.user.email,
          team_id: liveContext.scopeType === "team" ? liveContext.scopeId : null,
          title,
          summary,
          work_started_at: normalizeIsoDateOrNull(request.body?.work_started_at),
          work_ended_at: normalizeIsoDateOrNull(request.body?.work_ended_at),
          changed_files: changedFiles,
          blockers,
          source,
          agent_name: agentName,
          created_at: nowIso,
          updated_at: nowIso
        });
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    const effectiveSettings =
      getGovernanceSettingsForScope(snapshot, context.scopeType, context.scopeId) ??
      buildDefaultGovernanceSettings(context.scopeType, context.scopeId, new Date().toISOString());
    if (effectiveSettings.slack_enabled && effectiveSettings.slack_addon_active) {
      void dispatchSlackGovernanceNotification(
        effectiveSettings,
        [
          "*PG EOD submitted*",
          `Team: ${context.team?.team_key ?? "personal"}`,
          `By: ${auth.user.email}`,
          `Title: ${title}`,
          `Source: ${source}${agentName ? ` (${agentName})` : ""}`
        ].join("\n")
      ).catch((error) => {
        app.log.warn({ error: toErrorMessage(error), report_id: reportId }, "Slack EOD dispatch failed");
      });
    }
    return {
      ok: true,
      report_id: reportId,
      team_key: context.team?.team_key ?? null,
      dispatch: {
        slack: effectiveSettings.slack_enabled && effectiveSettings.slack_addon_active
      }
    };
  });

  app.get<{
    Querystring: { team_key?: string; limit?: number };
  }>("/account/governance/eod/list", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const teamKey = request.query?.team_key?.trim().toUpperCase() || undefined;
    const limit = clampInt(Number(request.query?.limit ?? 50), 1, 200);
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({
        error:
          "EOD governance reports are available for team/enterprise plans (or pro when enabled), and team access is required"
      });
    }

    const reports = snapshot.governance_eod_reports
      .filter((item) => {
        if (context.scopeType === "team") {
          return item.team_id === context.scopeId;
        }
        return item.user_id === auth.user.id && item.team_id === null;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);

    return { ok: true, reports };
  });

  app.post<{
    Body: {
      team_key?: string;
      title?: string;
      question?: string;
      vote_mode?: "majority" | "single_reviewer";
      options?: Array<{ option_key?: string; title?: string; rationale?: string | null }>;
    };
  }>("/account/governance/mastermind/thread/create", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase() || undefined;
    const title = request.body?.title?.trim();
    const question = request.body?.question?.trim();
    if (!title || !question) {
      return reply.code(400).send({ error: "title and question are required" });
    }
    if (title.length > 180) {
      return reply.code(400).send({ error: "title is too long" });
    }

    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (!context) {
      return reply.code(403).send({
        error:
          "mastermind is available for team/enterprise plans (or pro when enabled), and team access is required"
      });
    }
    const contextSettings =
      getGovernanceSettingsForScope(snapshot, context.scopeType, context.scopeId) ??
      buildDefaultGovernanceSettings(context.scopeType, context.scopeId, new Date().toISOString());
    if (question.length > contextSettings.max_debate_chars) {
      return reply.code(400).send({
        error: `question exceeds max_debate_chars (${contextSettings.max_debate_chars})`
      });
    }
    const options = parseMastermindOptionsInput(
      request.body?.options,
      contextSettings.max_debate_chars
    );
    if (options.length < 2) {
      return reply.code(400).send({ error: "at least two options are required for vote" });
    }

    let threadId = "";
    let voteMode: "majority" | "single_reviewer" = contextSettings.vote_mode;
    try {
      await store.update((state) => {
        const liveContext = resolveGovernanceContextForUser(state, auth.user.id, teamKey, false);
        if (!liveContext) {
          throw new Error("governance context was not found");
        }
        const liveSettings =
          getGovernanceSettingsForScope(state, liveContext.scopeType, liveContext.scopeId) ??
          upsertGovernanceSettings(state, liveContext.scopeType, liveContext.scopeId, {});
        const selectedVoteMode =
          normalizeGovernanceVoteMode(request.body?.vote_mode) ?? liveSettings.vote_mode;
        voteMode = selectedVoteMode;
        const now = new Date();
        const nowIso = now.toISOString();
        threadId = randomUUID();
        state.mastermind_threads.push({
          id: threadId,
          team_id: liveContext.scopeType === "team" ? liveContext.scopeId : null,
          created_by_user_id: auth.user.id,
          created_by_email: auth.user.email,
          title,
          question,
          status: "open",
          vote_mode: selectedVoteMode,
          decision: null,
          decision_option_key: null,
          decision_note: null,
          decided_by_user_id: null,
          decided_by_email: null,
          decided_at: null,
          last_activity_at: nowIso,
          expires_at: addDays(now, liveSettings.retention_days).toISOString(),
          created_at: nowIso,
          updated_at: nowIso
        });
        for (const option of options) {
          state.mastermind_options.push({
            id: randomUUID(),
            thread_id: threadId,
            option_key: option.option_key,
            title: option.title,
            rationale: option.rationale,
            created_at: nowIso
          });
        }
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    if (contextSettings.slack_enabled && contextSettings.slack_addon_active) {
      void dispatchSlackGovernanceNotification(
        contextSettings,
        [
          "*PG Mastermind thread opened*",
          `Team: ${context.team?.team_key ?? "personal"}`,
          `By: ${auth.user.email}`,
          `Title: ${title}`,
          `Question: ${question}`,
          `Vote mode: ${voteMode}`,
          `Thread ID: ${threadId}`
        ].join("\n")
      ).catch((error) => {
        app.log.warn({ error: toErrorMessage(error), thread_id: threadId }, "Slack thread dispatch failed");
      });
    }

    return {
      ok: true,
      thread_id: threadId,
      vote_mode: voteMode,
      options
    };
  });

  app.get<{
    Querystring: {
      team_key?: string;
      status?: "open" | "decided" | "closed";
      limit?: number;
    };
  }>("/account/governance/mastermind/threads", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const teamKey = request.query?.team_key?.trim().toUpperCase() || undefined;
    const statusFilter = request.query?.status;
    const limit = clampInt(Number(request.query?.limit ?? 50), 1, 300);
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, auth.user.id, teamKey, false);
    if (teamKey && !context) {
      return reply.code(403).send({ error: "team governance access is required for this team_key" });
    }

    const nowMs = Date.now();
    const threads = snapshot.mastermind_threads
      .filter((thread) => {
        if (context) {
          if (context.scopeType === "team") {
            if (thread.team_id !== context.scopeId) {
              return false;
            }
          } else if (thread.team_id !== null || !canAccessGovernanceThread(snapshot, thread, auth.user.id)) {
            return false;
          }
        } else if (!canAccessGovernanceThread(snapshot, thread, auth.user.id)) {
          return false;
        }
        if (new Date(thread.expires_at).getTime() <= nowMs) {
          return false;
        }
        if (statusFilter && thread.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
      .slice(0, limit)
      .map((thread) => {
        const optionCount = snapshot.mastermind_options.filter((item) => item.thread_id === thread.id).length;
        const voteCount = snapshot.mastermind_votes.filter((item) => item.thread_id === thread.id).length;
        const entryCount = snapshot.mastermind_entries.filter((item) => item.thread_id === thread.id).length;
        return {
          ...thread,
          option_count: optionCount,
          vote_count: voteCount,
          entry_count: entryCount
        };
      });

    return { ok: true, threads };
  });

  app.get<{
    Params: { thread_id?: string };
  }>("/account/governance/mastermind/thread/:thread_id", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const threadId = request.params?.thread_id?.trim();
    if (!threadId) {
      return reply.code(400).send({ error: "thread_id is required" });
    }

    const snapshot = store.snapshot();
    const thread = snapshot.mastermind_threads.find((item) => item.id === threadId);
    if (!thread || !canAccessGovernanceThread(snapshot, thread, auth.user.id)) {
      return reply.code(404).send({ error: "thread not found" });
    }

    return { ok: true, thread: buildMastermindThreadDetail(snapshot, thread) };
  });

  app.post<{
    Body: {
      thread_id?: string;
      entry_type?: "argument" | "suggestion" | "review";
      message?: string;
    };
  }>("/account/governance/mastermind/entry", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const threadId = request.body?.thread_id?.trim();
    const message = request.body?.message?.trim();
    const entryType = normalizeMastermindEntryType(request.body?.entry_type) ?? "suggestion";
    if (!threadId || !message) {
      return reply.code(400).send({ error: "thread_id and message are required" });
    }

    let entryId = "";
    try {
      await store.update((state) => {
        const thread = state.mastermind_threads.find((item) => item.id === threadId);
        if (!thread) {
          throw new Error("thread not found");
        }
        if (!canAccessGovernanceThread(state, thread, auth.user.id)) {
          throw new Error("not authorized for this thread");
        }
        if (thread.status !== "open") {
          throw new Error("thread is not open");
        }
        const settings = resolveGovernanceSettingsForThread(state, thread, auth.user.id);
        if (message.length > settings.max_debate_chars) {
          throw new Error(`message exceeds max_debate_chars (${settings.max_debate_chars})`);
        }
        const now = new Date();
        const nowIso = now.toISOString();
        thread.last_activity_at = nowIso;
        thread.updated_at = nowIso;
        thread.expires_at = addDays(now, settings.retention_days).toISOString();
        entryId = randomUUID();
        state.mastermind_entries.push({
          id: entryId,
          thread_id: thread.id,
          user_id: auth.user.id,
          email: auth.user.email,
          entry_type: entryType,
          message,
          created_at: nowIso
        });
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return { ok: true, entry_id: entryId };
  });

  app.post<{
    Body: {
      thread_id?: string;
      option_key?: string;
      rationale?: string;
    };
  }>("/account/governance/mastermind/vote", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const threadId = request.body?.thread_id?.trim();
    const optionKey = request.body?.option_key?.trim().toLowerCase();
    const rationale = request.body?.rationale?.trim() || null;
    if (!threadId || !optionKey) {
      return reply.code(400).send({ error: "thread_id and option_key are required" });
    }

    try {
      await store.update((state) => {
        const thread = state.mastermind_threads.find((item) => item.id === threadId);
        if (!thread) {
          throw new Error("thread not found");
        }
        if (!canAccessGovernanceThread(state, thread, auth.user.id)) {
          throw new Error("not authorized for this thread");
        }
        if (thread.status !== "open") {
          throw new Error("thread is not open");
        }
        const settings = resolveGovernanceSettingsForThread(state, thread, auth.user.id);
        if (rationale && rationale.length > settings.max_debate_chars) {
          throw new Error(`rationale exceeds max_debate_chars (${settings.max_debate_chars})`);
        }
        const option = state.mastermind_options.find(
          (item) => item.thread_id === thread.id && item.option_key === optionKey
        );
        if (!option) {
          throw new Error("option_key was not found in this thread");
        }

        const now = new Date();
        const nowIso = now.toISOString();
        thread.last_activity_at = nowIso;
        thread.updated_at = nowIso;
        thread.expires_at = addDays(now, settings.retention_days).toISOString();
        const existingVote = state.mastermind_votes.find(
          (item) => item.thread_id === thread.id && item.user_id === auth.user.id
        );
        if (existingVote) {
          existingVote.option_key = optionKey;
          existingVote.rationale = rationale;
          existingVote.updated_at = nowIso;
        } else {
          state.mastermind_votes.push({
            id: randomUUID(),
            thread_id: thread.id,
            option_key: optionKey,
            user_id: auth.user.id,
            email: auth.user.email,
            weight: 1,
            rationale,
            created_at: nowIso,
            updated_at: nowIso
          });
        }
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    const updated = store.snapshot();
    const thread = updated.mastermind_threads.find((item) => item.id === threadId);
    if (!thread) {
      return reply.code(404).send({ error: "thread not found after update" });
    }
    return {
      ok: true,
      tally: buildMastermindVoteTally(updated, thread.id)
    };
  });

  app.post<{
    Body: {
      thread_id?: string;
      decision?: "approve" | "reject" | "needs_change";
      option_key?: string | null;
      note?: string | null;
    };
  }>("/account/governance/mastermind/decide", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const threadId = request.body?.thread_id?.trim();
    const decision = normalizeMastermindDecision(request.body?.decision) ?? "approve";
    const requestedOptionKey = request.body?.option_key?.trim().toLowerCase() || null;
    const note = request.body?.note?.trim() || null;
    if (!threadId) {
      return reply.code(400).send({ error: "thread_id is required" });
    }
    if (note && note.length > 12000) {
      return reply.code(400).send({ error: "note is too long" });
    }

    let outcomeResult: StoreState["mastermind_outcomes"][number] | null = null;
    try {
      await store.update((state) => {
        const thread = state.mastermind_threads.find((item) => item.id === threadId);
        if (!thread) {
          throw new Error("thread not found");
        }
        if (!canFinalizeGovernanceThread(state, thread, auth.user.id)) {
          throw new Error("only owner/manager (or thread creator for personal scope) can finalize");
        }
        if (thread.status !== "open") {
          throw new Error("thread is already finalized");
        }
        const settings = resolveGovernanceSettingsForThread(state, thread, auth.user.id);
        if (note && note.length > settings.max_debate_chars) {
          throw new Error(`note exceeds max_debate_chars (${settings.max_debate_chars})`);
        }
        const now = new Date();
        const nowIso = now.toISOString();
        const winningOptionKey =
          requestedOptionKey ?? chooseWinningOptionFromVotes(state, thread.id) ?? null;
        if (winningOptionKey) {
          const option = state.mastermind_options.find(
            (item) => item.thread_id === thread.id && item.option_key === winningOptionKey
          );
          if (!option) {
            throw new Error("option_key was not found in this thread");
          }
        }

        thread.status = "decided";
        thread.decision = decision;
        thread.decision_option_key = winningOptionKey;
        thread.decision_note = note;
        thread.decided_by_user_id = auth.user.id;
        thread.decided_by_email = auth.user.email;
        thread.decided_at = nowIso;
        thread.last_activity_at = nowIso;
        thread.updated_at = nowIso;
        thread.expires_at = addDays(now, settings.retention_days).toISOString();

        const outcome: StoreState["mastermind_outcomes"][number] = {
          id: randomUUID(),
          thread_id: thread.id,
          team_id: thread.team_id,
          title: thread.title,
          decision,
          winning_option_key: winningOptionKey,
          decision_note: note,
          decided_by_email: auth.user.email,
          decided_at: nowIso,
          created_at: nowIso
        };
        state.mastermind_outcomes.push(outcome);
        outcomeResult = outcome;

        createGovernanceDecisionEvent(state, thread, outcome, settings.retention_days);
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    const snapshotAfter = store.snapshot();
    const finalOutcome =
      snapshotAfter.mastermind_outcomes
        .filter((item) => item.thread_id === threadId)
        .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0] ?? outcomeResult;
    if (finalOutcome) {
      const settings =
        finalOutcome.team_id !== null
          ? getGovernanceSettingsForScope(snapshotAfter, "team", finalOutcome.team_id) ??
            buildDefaultGovernanceSettings("team", finalOutcome.team_id, new Date().toISOString())
          : getGovernanceSettingsForScope(snapshotAfter, "user", auth.user.id) ??
            buildDefaultGovernanceSettings("user", auth.user.id, new Date().toISOString());
      if (settings.slack_enabled && settings.slack_addon_active) {
        void dispatchSlackGovernanceNotification(
          settings,
          [
            "*PG Mastermind decision finalized*",
            `Title: ${finalOutcome.title}`,
            `Decision: ${finalOutcome.decision}`,
            `Winning option: ${finalOutcome.winning_option_key ?? "none"}`,
            `By: ${auth.user.email}`,
            `Thread ID: ${finalOutcome.thread_id}`
          ].join("\n")
        ).catch((error) => {
          app.log.warn(
            { error: toErrorMessage(error), thread_id: finalOutcome.thread_id },
            "Slack decision dispatch failed"
          );
        });
      }
    }

    return { ok: true, outcome: finalOutcome };
  });

  app.get<{
    Querystring: { since_sequence?: number; limit?: number };
  }>("/account/governance/sync/pull", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const sinceSequence = Math.max(0, Number(request.query?.since_sequence ?? 0));
    const limit = clampInt(Number(request.query?.limit ?? 100), 1, 500);
    const snapshot = store.snapshot();
    const nowMs = Date.now();

    const ackByEventId = new Map(
      snapshot.governance_decision_acks
        .filter((ack) => ack.user_id === auth.user.id)
        .map((ack) => [ack.event_id, ack] as const)
    );
    const events = snapshot.governance_decision_events
      .filter((event) => {
        if (event.sequence <= sinceSequence) {
          return false;
        }
        if (new Date(event.expires_at).getTime() <= nowMs) {
          return false;
        }
        if (ackByEventId.has(event.id)) {
          return true;
        }
        if (!event.team_id) {
          return false;
        }
        return hasActiveTeamSeat(snapshot, event.team_id, auth.user.id);
      })
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, limit)
      .map((event) => ({
        ...event,
        ack: ackByEventId.get(event.id) ?? null
      }));

    return {
      ok: true,
      events,
      cursor: events.length > 0 ? events[events.length - 1].sequence : sinceSequence
    };
  });

  app.post<{
    Body: {
      event_id?: string;
      status?: "applied" | "conflict" | "skipped";
      note?: string | null;
    };
  }>("/account/governance/sync/ack", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    const eventId = request.body?.event_id?.trim();
    const status = request.body?.status;
    const note = request.body?.note?.trim() || null;
    if (!eventId || !status) {
      return reply.code(400).send({ error: "event_id and status are required" });
    }
    if (status !== "applied" && status !== "conflict" && status !== "skipped") {
      return reply.code(400).send({ error: "invalid ack status" });
    }
    if (note && note.length > 12000) {
      return reply.code(400).send({ error: "note is too long" });
    }

    try {
      await store.update((state) => {
        const event = state.governance_decision_events.find((item) => item.id === eventId);
        if (!event) {
          throw new Error("event not found");
        }
        if (new Date(event.expires_at).getTime() <= Date.now()) {
          throw new Error("event expired");
        }
        if (event.team_id && !hasActiveTeamSeat(state, event.team_id, auth.user.id)) {
          const existingAck = state.governance_decision_acks.find(
            (item) => item.event_id === event.id && item.user_id === auth.user.id
          );
          if (!existingAck) {
            throw new Error("you are not eligible to acknowledge this event");
          }
        }
        const nowIso = new Date().toISOString();
        const existing = state.governance_decision_acks.find(
          (item) => item.event_id === event.id && item.user_id === auth.user.id
        );
        if (existing) {
          existing.status = status;
          existing.note = note;
          existing.updated_at = nowIso;
          existing.acked_at = nowIso;
        } else {
          state.governance_decision_acks.push({
            id: randomUUID(),
            event_id: event.id,
            user_id: auth.user.id,
            status,
            note,
            updated_at: nowIso,
            acked_at: nowIso
          });
        }
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }
    return { ok: true, event_id: eventId, status };
  });

  app.post<{
    Body: { team_key?: string; active?: boolean };
  }>(`${ADMIN_ROUTE_PREFIX}/governance/slack-addon/team`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase();
    if (!teamKey) {
      return reply.code(400).send({ error: "team_key is required" });
    }
    const snapshot = store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    if (!team) {
      return reply.code(404).send({ error: "team not found" });
    }
    let slackAddonActive = false;
    let settings: unknown = null;
    try {
      await store.update((state) => {
        const updated = setGovernanceSlackAddonState(
          state,
          "team",
          team.id,
          request.body?.active === true
        );
        slackAddonActive = updated.slack_addon_active;
        settings = updated;
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }
    return {
      ok: true,
      team_key: teamKey,
      slack_addon_active: slackAddonActive,
      settings
    };
  });

  app.post<{
    Body: { email?: string; active?: boolean };
  }>(`${ADMIN_ROUTE_PREFIX}/governance/slack-addon/user`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const email = normalizeEmail(request.body?.email);
    if (!email) {
      return reply.code(400).send({ error: "email is required" });
    }
    const snapshot = store.snapshot();
    const user = snapshot.users.find((item) => item.email === email);
    if (!user) {
      return reply.code(404).send({ error: "user not found" });
    }
    let slackAddonActive = false;
    let settings: unknown = null;
    try {
      await store.update((state) => {
        const updated = setGovernanceSlackAddonState(
          state,
          "user",
          user.id,
          request.body?.active === true
        );
        slackAddonActive = updated.slack_addon_active;
        settings = updated;
        pruneGovernanceState(state);
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }
    return {
      ok: true,
      email,
      slack_addon_active: slackAddonActive,
      settings
    };
  });

  app.get(`${ADMIN_ROUTE_PREFIX}/board/governance`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }
    const snapshot = store.snapshot();
    const nowMs = Date.now();
    const openThreads = snapshot.mastermind_threads.filter(
      (item) => item.status === "open" && new Date(item.expires_at).getTime() > nowMs
    );
    const decidedThreads = snapshot.mastermind_threads.filter((item) => item.status === "decided");
    const activeSlackScopes = snapshot.governance_settings.filter(
      (item) => item.slack_addon_active && item.slack_enabled
    );
    return {
      ok: true,
      totals: {
        eod_reports: snapshot.governance_eod_reports.length,
        mastermind_open: openThreads.length,
        mastermind_decided: decidedThreads.length,
        governance_scopes_with_slack_enabled: activeSlackScopes.length,
        decision_events_pending_ack: snapshot.governance_decision_acks.filter(
          (item) => item.status === "pending"
        ).length
      }
    };
  });

  app.get(`${ADMIN_ROUTE_PREFIX}/board/summary`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }

    const snapshot = store.snapshot();
    const now = new Date();
    const activeSubscriptions = snapshot.subscriptions.filter(
      (item) => item.status === "active" && new Date(item.ends_at).getTime() > now.getTime()
    );
    const paidUserIds = new Set(activeSubscriptions.map((item) => item.user_id));
    const openTickets = snapshot.support_tickets.filter(
      (item) => item.status === "open" || item.status === "in_progress"
    );
    const pendingOfflinePayments = snapshot.offline_payment_refs.filter(
      (item) => item.status === "pending" || item.status === "submitted"
    );
    const pendingRefunds = snapshot.refund_requests.filter((item) => item.status === "requested");
    const openMastermind = snapshot.mastermind_threads.filter((item) => item.status === "open");
    const pendingDecisionAcks = snapshot.governance_decision_acks.filter(
      (item) => item.status === "pending"
    );
    const recentUsers = [...snapshot.users]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)
      .map((user) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        current_plan: resolveEffectivePlan(snapshot, user.id, now).plan,
        has_active_paid_subscription: paidUserIds.has(user.id)
      }));

    return {
      ok: true,
      admin: { email: adminAccess.userEmail ?? "key-admin", mode: adminAccess.mode },
      totals: {
        users_registered: snapshot.users.length,
        users_paid_active: paidUserIds.size,
        users_free_or_trial: Math.max(0, snapshot.users.length - paidUserIds.size),
        subscriptions_active: activeSubscriptions.length,
        support_tickets_open: openTickets.length,
        refunds_pending: pendingRefunds.length,
        offline_payments_pending: pendingOfflinePayments.length,
        governance_threads_open: openMastermind.length,
        governance_acks_pending: pendingDecisionAcks.length
      },
      recent_users: recentUsers
    };
  });

  app.get<{
    Querystring: { q?: string; limit?: number };
  }>(`${ADMIN_ROUTE_PREFIX}/board/users`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }

    const query = request.query?.q?.trim().toLowerCase() ?? "";
    const limit = Math.max(1, Math.min(500, Number(request.query?.limit ?? 100)));
    const snapshot = store.snapshot();
    const now = new Date();
    const superAdminEmails = await getSuperAdminEmailSet();
    const users = [...snapshot.users]
      .filter((user) => !query || user.email.includes(query) || user.id.includes(query))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((user) => {
        const planState = resolveEffectivePlan(snapshot, user.id, now);
        const latestSubscription = [...snapshot.subscriptions]
          .filter((item) => item.user_id === user.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_login_at: user.last_login_at,
          current_plan: planState.plan,
          is_super_admin: superAdminEmails.has(user.email),
          latest_subscription: latestSubscription
            ? {
                id: latestSubscription.id,
                plan_id: latestSubscription.plan_id,
                status: latestSubscription.status,
                source: latestSubscription.source,
                ends_at: latestSubscription.ends_at
              }
            : null
        };
      });

    return { ok: true, users };
  });

  app.get<{
    Querystring: { status?: "active" | "expired" | "revoked" | "refunded"; limit?: number };
  }>(`${ADMIN_ROUTE_PREFIX}/board/subscriptions`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }

    const statusFilter = request.query?.status;
    const limit = Math.max(1, Math.min(500, Number(request.query?.limit ?? 200)));
    const snapshot = store.snapshot();
    const subscriptions = [...snapshot.subscriptions]
      .filter((item) => !statusFilter || item.status === statusFilter)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((item) => ({
        ...item,
        email: snapshot.users.find((user) => user.id === item.user_id)?.email ?? null
      }));
    return { ok: true, subscriptions };
  });

  app.get<{
    Querystring: { status?: "open" | "in_progress" | "resolved" | "closed"; limit?: number };
  }>(`${ADMIN_ROUTE_PREFIX}/board/support`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }

    const statusFilter = request.query?.status;
    const limit = Math.max(1, Math.min(500, Number(request.query?.limit ?? 200)));
    const snapshot = store.snapshot();
    const tickets = [...snapshot.support_tickets]
      .filter((item) => !statusFilter || item.status === statusFilter)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
    return { ok: true, tickets };
  });

  app.get(`${ADMIN_ROUTE_PREFIX}/board/payments`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.BOARD_READ
    );
    if (!adminAccess) {
      return;
    }

    const snapshot = store.snapshot();
    const offline = [...snapshot.offline_payment_refs].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
    const refunds = [...snapshot.refund_requests]
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
      .map((refund) => ({
        ...refund,
        email: snapshot.users.find((user) => user.id === refund.user_id)?.email ?? null
      }));
    return { ok: true, offline_references: offline, refund_requests: refunds };
  });

  app.post<{
    Body: {
      ticket_id?: string;
      status?: "open" | "in_progress" | "resolved" | "closed";
      resolution_note?: string;
    };
  }>(`${ADMIN_ROUTE_PREFIX}/board/support/status`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.BOARD_SUPPORT_WRITE
    );
    if (!adminAccess) {
      return;
    }
    const ticketId = request.body?.ticket_id?.trim();
    const status = request.body?.status;
    const resolutionNote = request.body?.resolution_note?.trim() || null;
    if (!ticketId || !status) {
      return reply.code(400).send({ error: "ticket_id and status are required" });
    }

    try {
      await store.update((state) => {
        const ticket = state.support_tickets.find((item) => item.id === ticketId);
        if (!ticket) {
          throw new Error("support ticket not found");
        }
        ticket.status = status;
        ticket.updated_at = new Date().toISOString();
        ticket.resolution_note = resolutionNote;
      });
    } catch (error) {
      return reply.code(404).send({ error: toErrorMessage(error) });
    }

    return { ok: true, ticket_id: ticketId, status };
  });

  app.post<{
    Body: { subscription_id?: string };
  }>(`${ADMIN_ROUTE_PREFIX}/board/subscription/revoke`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.BOARD_SUBSCRIPTION_WRITE
    );
    if (!adminAccess) {
      return;
    }
    const subscriptionId = request.body?.subscription_id?.trim();
    if (!subscriptionId) {
      return reply.code(400).send({ error: "subscription_id is required" });
    }

    try {
      await store.update((state) => {
        const subscription = state.subscriptions.find((item) => item.id === subscriptionId);
        if (!subscription) {
          throw new Error("subscription not found");
        }
        if (subscription.status !== "active") {
          throw new Error("subscription is not active");
        }
        subscription.status = "revoked";
        subscription.revoked_at = new Date().toISOString();

        const entitlement = state.product_entitlements.find(
          (item) => item.user_id === subscription.user_id && item.status === "active"
        );
        if (entitlement) {
          entitlement.status = "revoked";
          entitlement.ends_at = new Date().toISOString();
        }
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return { ok: true, subscription_id: subscriptionId };
  });

  app.post<{
    Body: { user_id?: string };
  }>(`${ADMIN_ROUTE_PREFIX}/board/sessions/revoke-user`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.BOARD_SESSION_REVOKE
    );
    if (!adminAccess) {
      return;
    }
    const userId = request.body?.user_id?.trim();
    if (!userId) {
      return reply.code(400).send({ error: "user_id is required" });
    }

    let revokedCount = 0;
    await store.update((state) => {
      const nowIso = new Date().toISOString();
      for (const session of state.sessions) {
        if (session.user_id === userId) {
          session.expires_at = nowIso;
          revokedCount += 1;
        }
      }
    });

    return { ok: true, user_id: userId, sessions_revoked: revokedCount };
  });

  app.post<{ Body: { request_id?: string } }>(
    `${ADMIN_ROUTE_PREFIX}/refund/approve`,
    async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.REFUND_APPROVE
    );
    if (!adminAccess) {
      return;
    }
    const requestId = request.body?.request_id?.trim();
    if (!requestId) {
      return reply.code(400).send({ error: "request_id is required" });
    }

    await store.update((state) => {
      const refund = state.refund_requests.find((item) => item.id === requestId);
      if (!refund) {
        throw new Error("refund request not found");
      }
      if (refund.status !== "requested") {
        throw new Error("refund request is not pending");
      }

      refund.status = "approved";
      refund.approved_at = new Date().toISOString();

      const sub = state.subscriptions.find((item) => item.id === refund.subscription_id);
      if (sub) {
        sub.status = "refunded";
        sub.revoked_at = new Date().toISOString();
      }

      const entitlement = state.product_entitlements.find(
        (item) => item.user_id === refund.user_id && item.status === "active"
      );
      if (entitlement) {
        entitlement.status = "refunded";
        entitlement.ends_at = new Date().toISOString();
      }
    });

    return { ok: true };
    }
  );

  app.post<{
    Body: {
      email?: string;
      plan_id?: PaidPlanTier;
      module_scope?: ModuleScope;
      years?: number;
    };
  }>(`${ADMIN_ROUTE_PREFIX}/subscription/grant`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.SUBSCRIPTION_GRANT
    );
    if (!adminAccess) {
      return;
    }
    const email = normalizeEmail(request.body?.email);
    const planId = request.body?.plan_id;
    const moduleScope = request.body?.module_scope ?? "narrate";
    const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
    if (!email || !planId) {
      return reply.code(400).send({ error: "email and plan_id are required" });
    }
    const grant = await grantSubscriptionByEmail({
      email,
      planId,
      moduleScope,
      years,
      source: "manual"
    });

    return {
      ok: true,
      email,
      plan_id: planId,
      module_scope: moduleScope,
      ends_at: grant.endsAt
    };
  });

  app.post<{
    Body: {
      owner_email?: string;
      team_key?: string;
      plan_id?: "team" | "enterprise";
      module_scope?: ModuleScope;
      seat_limit?: number;
      years?: number;
    };
  }>(`${ADMIN_ROUTE_PREFIX}/team/create`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const ownerEmail = normalizeEmail(request.body?.owner_email);
    const planId = request.body?.plan_id ?? "team";
    const moduleScope = request.body?.module_scope ?? "bundle";
    const seatLimit = Math.max(1, request.body?.seat_limit ?? 5);
    const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
    const requestedTeamKey = request.body?.team_key?.trim().toUpperCase();
    if (!ownerEmail) {
      return reply.code(400).send({ error: "owner_email is required" });
    }

    const owner = await getOrCreateUserByEmail(ownerEmail);
    const teamKey = requestedTeamKey || `TEAM-${randomBytes(3).toString("hex").toUpperCase()}`;
    let teamId = "";
    try {
      await store.update((state) => {
        if (state.teams.some((item) => item.team_key === teamKey)) {
          throw new Error("team_key already exists");
        }
        teamId = randomUUID();
        state.teams.push({
          id: teamId,
          team_key: teamKey,
          owner_user_id: owner.id,
          plan_id: planId,
          module_scope: moduleScope,
          seat_limit: seatLimit,
          created_at: new Date().toISOString()
        });
        state.team_memberships.push({
          id: randomUUID(),
          team_id: teamId,
          user_id: owner.id,
          role: "owner",
          status: "active",
          invited_email: owner.email,
          created_at: new Date().toISOString(),
          revoked_at: null
        });
      });
    } catch (error) {
      return reply.code(409).send({ error: toErrorMessage(error) });
    }

    const grant = await grantSubscriptionByUserId({
      userId: owner.id,
      planId,
      moduleScope,
      years,
      source: "manual",
      teamId
    });

    return {
      ok: true,
      team_key: teamKey,
      owner_email: owner.email,
      seat_limit: seatLimit,
      ends_at: grant.endsAt
    };
  });

  app.post<{
    Body: {
      team_key?: string;
      email?: string;
      role?: "owner" | "manager" | "member";
      years?: number;
    };
  }>(`${ADMIN_ROUTE_PREFIX}/team/assign-seat`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const email = normalizeEmail(request.body?.email);
    const role = request.body?.role ?? "member";
    const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
    if (!teamKey || !email) {
      return reply.code(400).send({ error: "team_key and email are required" });
    }

    const snapshot = store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    if (!team) {
      return reply.code(404).send({ error: "team not found" });
    }

    const user = await getOrCreateUserByEmail(email);
    const activeSeats = snapshot.team_memberships.filter(
      (item) => item.team_id === team.id && item.status === "active"
    ).length;
    const existingActive = snapshot.team_memberships.find(
      (item) => item.team_id === team.id && item.user_id === user.id && item.status === "active"
    );
    if (!existingActive && activeSeats >= team.seat_limit) {
      return reply.code(403).send({ error: "team seat limit reached" });
    }

    await store.update((state) => {
      const membership = state.team_memberships.find(
        (item) => item.team_id === team.id && item.user_id === user.id
      );
      if (membership) {
        membership.status = "active";
        membership.revoked_at = null;
        membership.role = role;
        membership.invited_email = email;
      } else {
        state.team_memberships.push({
          id: randomUUID(),
          team_id: team.id,
          user_id: user.id,
          role,
          status: "active",
          invited_email: email,
          created_at: new Date().toISOString(),
          revoked_at: null
        });
      }
    });

    const grant = await grantSubscriptionByUserId({
      userId: user.id,
      planId: team.plan_id,
      moduleScope: team.module_scope,
      years,
      source: "manual",
      teamId: team.id
    });

    return { ok: true, team_key: teamKey, email, ends_at: grant.endsAt };
  });

  app.post<{
    Body: { team_key?: string; email?: string };
  }>(`${ADMIN_ROUTE_PREFIX}/team/revoke-seat`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase();
    const email = normalizeEmail(request.body?.email);
    if (!teamKey || !email) {
      return reply.code(400).send({ error: "team_key and email are required" });
    }

    const snapshot = store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    const user = snapshot.users.find((item) => item.email === email);
    if (!team || !user) {
      return reply.code(404).send({ error: "team or user not found" });
    }

    await store.update((state) => {
      const membership = state.team_memberships.find(
        (item) => item.team_id === team.id && item.user_id === user.id && item.status === "active"
      );
      if (!membership) {
        throw new Error("active membership not found");
      }
      membership.status = "revoked";
      membership.revoked_at = new Date().toISOString();

      for (const sub of state.subscriptions) {
        if (
          sub.user_id === user.id &&
          sub.team_id === team.id &&
          sub.status === "active"
        ) {
          sub.status = "revoked";
          sub.revoked_at = new Date().toISOString();
        }
      }
    });

    return { ok: true, team_key: teamKey, email };
  });

  app.get<{
    Querystring: { team_key?: string };
  }>(`${ADMIN_ROUTE_PREFIX}/team/status`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.TEAM_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.query?.team_key?.trim().toUpperCase();
    if (!teamKey) {
      return reply.code(400).send({ error: "team_key is required" });
    }

    const snapshot = store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    if (!team) {
      return reply.code(404).send({ error: "team not found" });
    }
    const members = snapshot.team_memberships
      .filter((item) => item.team_id === team.id)
      .map((item) => ({
        ...item,
        email: snapshot.users.find((user) => user.id === item.user_id)?.email ?? item.invited_email
      }));
    const activeSeats = members.filter((item) => item.status === "active").length;

    return {
      ok: true,
      team,
      seats: {
        used: activeSeats,
        limit: team.seat_limit,
        remaining: Math.max(0, team.seat_limit - activeSeats)
      },
      members
    };
  });

  app.post<{
    Body: {
      team_key?: string;
      local_only?: boolean;
      byo_allowed?: boolean;
      allowlist?: string[];
      denylist?: string[];
    };
  }>(`${ADMIN_ROUTE_PREFIX}/team/provider-policy/set`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.PROVIDER_POLICY_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const teamKey = request.body?.team_key?.trim().toUpperCase();
    if (!teamKey) {
      return reply.code(400).send({ error: "team_key is required" });
    }

    const snapshot = store.snapshot();
    const team = snapshot.teams.find((item) => item.team_key === teamKey);
    if (!team) {
      return reply.code(404).send({ error: "team not found" });
    }

    const policy = normalizePolicyInput(request.body);
    await upsertProviderPolicy("team", team.id, policy);
    return { ok: true, team_key: teamKey, policy };
  });

  app.post<{
    Body: {
      email?: string;
      local_only?: boolean;
      byo_allowed?: boolean;
      allowlist?: string[];
      denylist?: string[];
    };
  }>(`${ADMIN_ROUTE_PREFIX}/provider-policy/set-user`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.PROVIDER_POLICY_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const email = normalizeEmail(request.body?.email);
    if (!email) {
      return reply.code(400).send({ error: "email is required" });
    }
    const snapshot = store.snapshot();
    const user = snapshot.users.find((item) => item.email === email);
    if (!user) {
      return reply.code(404).send({ error: "user not found" });
    }

    const policy = normalizePolicyInput(request.body);
    await upsertProviderPolicy("user", user.id, policy);
    return { ok: true, email, policy };
  });

  app.post<{
    Body: {
      plan_id?: PaidPlanTier;
      module_scope?: ModuleScope;
      years?: number;
      affiliate_code?: string;
    };
  }>("/payments/stripe/create-checkout-session", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }
    if (!STRIPE_SECRET_KEY) {
      return reply.code(503).send({ error: "Stripe is not configured on this server." });
    }

    const planId = request.body?.plan_id;
    const moduleScope = request.body?.module_scope ?? "narrate";
    const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
    const affiliateCode = request.body?.affiliate_code?.trim() || "";
    if (!planId) {
      return reply.code(400).send({ error: "plan_id is required" });
    }

    const priceId = resolveStripePriceId(planId, moduleScope);
    if (!priceId) {
      return reply.code(400).send({
        error: `Missing Stripe price mapping for ${planId}:${moduleScope}. Configure STRIPE_PRICE_MAP.`
      });
    }

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", CHECKOUT_SUCCESS_URL);
    form.set("cancel_url", CHECKOUT_CANCEL_URL);
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", "1");
    form.set("metadata[email]", auth.user.email);
    form.set("metadata[plan_id]", planId);
    form.set("metadata[module_scope]", moduleScope);
    form.set("metadata[years]", String(years));
    if (affiliateCode) {
      form.set("metadata[affiliate_code]", affiliateCode);
    }
    form.set("customer_email", auth.user.email);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });
    const raw = await stripeResponse.text();
    const parsed = safeJson(raw) as Record<string, unknown>;
    if (!stripeResponse.ok) {
      const stripeMessage =
        typeof parsed.error === "object" &&
        parsed.error &&
        "message" in parsed.error
          ? String((parsed.error as Record<string, unknown>).message)
          : raw;
      return reply.code(502).send({ error: `Stripe checkout session creation failed: ${stripeMessage}` });
    }

    const url = typeof parsed.url === "string" ? parsed.url : "";
    const sessionId = typeof parsed.id === "string" ? parsed.id : "";
    if (!url || !sessionId) {
      return reply.code(502).send({ error: "Stripe response did not include session url/id." });
    }

    return { ok: true, url, session_id: sessionId };
  });

  app.post<{
    Body: Record<string, unknown> & { __raw_json_body?: string };
  }>("/payments/stripe/webhook", async (request, reply) => {
    const rawPayload =
      typeof request.body?.__raw_json_body === "string"
        ? request.body.__raw_json_body
        : JSON.stringify(request.body ?? {});
    const signatureHeader = request.headers["stripe-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (!STRIPE_WEBHOOK_SECRET) {
      return reply.code(503).send({ error: "STRIPE_WEBHOOK_SECRET is not configured." });
    }
    if (!signature) {
      return reply.code(400).send({ error: "Missing stripe-signature header." });
    }
    if (!verifyStripeSignature(rawPayload, signature, STRIPE_WEBHOOK_SECRET)) {
      return reply.code(401).send({ error: "Invalid stripe webhook signature." });
    }

    const payload = safeJson(rawPayload) as Record<string, unknown>;
    const eventId = typeof payload.id === "string" ? payload.id : "";
    const eventType = typeof payload.type === "string" ? payload.type : "";
    if (!eventId || !eventType) {
      return reply.code(400).send({ error: "Invalid Stripe event payload." });
    }

    const snapshot = store.snapshot();
    if (snapshot.stripe_events.some((item) => item.event_id === eventId)) {
      return { ok: true, idempotent: true };
    }

    if (eventType !== "checkout.session.completed") {
      await store.update((state) => {
        state.stripe_events.push({
          id: randomUUID(),
          event_id: eventId,
          event_type: eventType,
          created_at: new Date().toISOString()
        });
      });
      return { ok: true, ignored: true, event_type: eventType };
    }

    const eventObject = getObject(payload, ["data", "object"]);
    const metadata = getObject(eventObject, ["metadata"]);
    const emailCandidate = getString(metadata, "email") || getString(getObject(eventObject, ["customer_details"]), "email");
    const email = normalizeEmail(emailCandidate);
    const planId = asPaidPlanTier(getString(metadata, "plan_id"));
    const moduleScope = asModuleScope(getString(metadata, "module_scope")) ?? "narrate";
    const years = Math.max(1, Number.parseInt(getString(metadata, "years") || "1", 10) || 1);
    const affiliateCode = (getString(metadata, "affiliate_code") || "").trim().toUpperCase();
    const grossAmount = Math.max(0, getNumber(eventObject, "amount_total") ?? 0);

    if (!email || !planId) {
      return reply.code(400).send({ error: "Stripe metadata email and plan_id are required." });
    }

    const grant = await grantSubscriptionByEmail({
      email,
      planId,
      moduleScope,
      years,
      source: "stripe"
    });

    await store.update((state) => {
      state.stripe_events.push({
        id: randomUUID(),
        event_id: eventId,
        event_type: eventType,
        created_at: new Date().toISOString()
      });
    });

    if (affiliateCode && grossAmount > 0) {
      await recordAffiliatePaidConversion(affiliateCode, email, eventId, grossAmount);
    }

    return { ok: true, idempotent: false, event_id: eventId, ends_at: grant.endsAt };
  });

  app.post<{
    Body: {
      email?: string;
      amount_cents?: number;
      plan_id?: PaidPlanTier;
      module_scope?: ModuleScope;
      years?: number;
    };
  }>("/payments/offline/create-ref", async (request, reply) => {
    const email = normalizeEmail(request.body?.email);
    const amountCents = Math.max(0, request.body?.amount_cents ?? 0);
    const planId = request.body?.plan_id;
    const moduleScope = request.body?.module_scope ?? "narrate";
    const years = request.body?.years && request.body.years > 0 ? request.body.years : 1;
    if (!email || !planId || amountCents <= 0) {
      return reply.code(400).send({ error: "email, plan_id and amount_cents are required" });
    }

    const now = new Date();
    const refCode = generateCode("OFF");
    await store.update((state) => {
      state.offline_payment_refs.push({
        id: randomUUID(),
        email,
        ref_code: refCode,
        amount_cents: amountCents,
        plan_id: planId,
        module_scope: moduleScope,
        years,
        proof_url: null,
        status: "pending",
        expires_at: addDays(now, OFFLINE_REF_TTL_DAYS).toISOString(),
        created_at: now.toISOString(),
        submitted_at: null,
        approved_at: null,
        rejected_at: null,
        rejection_reason: null,
        redeem_code: null
      });
    });

    return {
      ok: true,
      ref_code: refCode,
      expires_at: addDays(now, OFFLINE_REF_TTL_DAYS).toISOString()
    };
  });

  app.post<{
    Body: { ref_code?: string; proof_url?: string };
  }>("/payments/offline/submit-proof", async (request, reply) => {
    const refCode = request.body?.ref_code?.trim().toUpperCase();
    const proofUrl = request.body?.proof_url?.trim() || null;
    if (!refCode || !proofUrl) {
      return reply.code(400).send({ error: "ref_code and proof_url are required" });
    }

    try {
      await store.update((state) => {
        const ref = state.offline_payment_refs.find((item) => item.ref_code === refCode);
        if (!ref) {
          throw new Error("offline ref not found");
        }
        if (new Date(ref.expires_at).getTime() <= Date.now()) {
          throw new Error("offline ref expired");
        }
        if (ref.status === "approved") {
          return;
        }
        if (ref.status === "rejected") {
          throw new Error("offline ref rejected");
        }
        ref.proof_url = proofUrl;
        ref.status = "submitted";
        ref.submitted_at = new Date().toISOString();
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return { ok: true, status: "submitted" };
  });

  app.post<{
    Body: { ref_code?: string };
  }>(`${ADMIN_ROUTE_PREFIX}/offline/approve`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.OFFLINE_PAYMENT_REVIEW
    );
    if (!adminAccess) {
      return;
    }
    const refCode = request.body?.ref_code?.trim().toUpperCase();
    if (!refCode) {
      return reply.code(400).send({ error: "ref_code is required" });
    }

    let redeemCode = "";
    try {
      await store.update((state) => {
        const ref = state.offline_payment_refs.find((item) => item.ref_code === refCode);
        if (!ref) {
          throw new Error("offline ref not found");
        }
        if (ref.status === "rejected") {
          throw new Error("offline ref rejected");
        }
        if (ref.status === "approved" && ref.redeem_code) {
          redeemCode = ref.redeem_code;
          return;
        }

        redeemCode = generateCode("RDM");
        ref.status = "approved";
        ref.approved_at = new Date().toISOString();
        ref.redeem_code = redeemCode;

        state.redeem_codes.push({
          id: randomUUID(),
          code: redeemCode,
          email: ref.email,
          plan_id: ref.plan_id,
          module_scope: ref.module_scope,
          years: ref.years,
          status: "unused",
          source: "offline",
          created_at: new Date().toISOString(),
          used_at: null,
          used_by_user_id: null,
          revoked_at: null
        });
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return { ok: true, ref_code: refCode, redeem_code: redeemCode };
  });

  app.post<{
    Body: { ref_code?: string; reason?: string };
  }>(`${ADMIN_ROUTE_PREFIX}/offline/reject`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.OFFLINE_PAYMENT_REVIEW
    );
    if (!adminAccess) {
      return;
    }
    const refCode = request.body?.ref_code?.trim().toUpperCase();
    if (!refCode) {
      return reply.code(400).send({ error: "ref_code is required" });
    }
    const reason = request.body?.reason?.trim() || null;

    try {
      await store.update((state) => {
        const ref = state.offline_payment_refs.find((item) => item.ref_code === refCode);
        if (!ref) {
          throw new Error("offline ref not found");
        }
        if (ref.status === "approved") {
          throw new Error("cannot reject an approved offline ref");
        }
        ref.status = "rejected";
        ref.rejected_at = new Date().toISOString();
        ref.rejection_reason = reason;
      });
    } catch (error) {
      return reply.code(400).send({ error: toErrorMessage(error) });
    }

    return { ok: true, ref_code: refCode, status: "rejected" };
  });

  app.post<{
    Body: { code?: string };
  }>("/redeem/apply", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const code = request.body?.code?.trim().toUpperCase();
    if (!code) {
      return reply.code(400).send({ error: "code is required" });
    }

    const snapshot = store.snapshot();
    const redeem = snapshot.redeem_codes.find((item) => item.code === code);
    if (!redeem) {
      return reply.code(404).send({ error: "redeem code not found" });
    }
    if (redeem.status !== "unused") {
      return reply.code(409).send({ error: "redeem code already used or revoked" });
    }
    if (redeem.email !== auth.user.email) {
      return reply.code(403).send({ error: "redeem code is not valid for this account email" });
    }

    const grant = await grantSubscriptionByUserId({
      userId: auth.user.id,
      planId: redeem.plan_id,
      moduleScope: redeem.module_scope,
      years: redeem.years,
      source: "offline"
    });

    await store.update((state) => {
      const codeRecord = state.redeem_codes.find((item) => item.code === code);
      if (!codeRecord) {
        throw new Error("redeem code not found");
      }
      if (codeRecord.status !== "unused") {
        throw new Error("redeem code already used or revoked");
      }
      codeRecord.status = "used";
      codeRecord.used_at = new Date().toISOString();
      codeRecord.used_by_user_id = auth.user.id;
    });

    return {
      ok: true,
      plan_id: redeem.plan_id,
      module_scope: redeem.module_scope,
      ends_at: grant.endsAt
    };
  });

  app.post<{
    Body: { code?: string; commission_rate_bps?: number };
  }>("/affiliate/code/create", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const requestedCode = request.body?.code?.trim().toUpperCase();
    const commissionRateBps = clampCommissionRate(
      request.body?.commission_rate_bps ?? DEFAULT_AFFILIATE_RATE_BPS
    );

    const snapshot = store.snapshot();
    const existing = snapshot.affiliate_codes.find(
      (item) => item.user_id === auth.user.id && item.status === "active"
    );
    if (existing) {
      return {
        ok: true,
        code: existing.code,
        commission_rate_bps: existing.commission_rate_bps,
        idempotent: true
      };
    }

    const code = requestedCode && requestedCode.length >= 6 ? requestedCode : generateCode("AFF");
    if (snapshot.affiliate_codes.some((item) => item.code === code)) {
      return reply.code(409).send({ error: "affiliate code already exists" });
    }

    await store.update((state) => {
      state.affiliate_codes.push({
        id: randomUUID(),
        user_id: auth.user.id,
        code,
        commission_rate_bps: commissionRateBps,
        status: "active",
        created_at: new Date().toISOString()
      });
    });

    return { ok: true, code, commission_rate_bps: commissionRateBps, idempotent: false };
  });

  app.post<{
    Body: { code?: string };
  }>("/affiliate/track-click", async (request, reply) => {
    const code = request.body?.code?.trim().toUpperCase();
    if (!code) {
      return reply.code(400).send({ error: "code is required" });
    }
    const snapshot = store.snapshot();
    const affiliateCode = snapshot.affiliate_codes.find(
      (item) => item.code === code && item.status === "active"
    );
    if (!affiliateCode) {
      return reply.code(404).send({ error: "affiliate code not found" });
    }

    const conversionId = randomUUID();
    await store.update((state) => {
      state.affiliate_conversions.push({
        id: conversionId,
        affiliate_user_id: affiliateCode.user_id,
        buyer_user_id: null,
        ref_code: code,
        status: "clicked",
        order_id: null,
        gross_amount_cents: 0,
        commission_amount_cents: 0,
        confirmed_at: null,
        created_at: new Date().toISOString(),
        payout_id: null
      });
    });

    return { ok: true, conversion_id: conversionId };
  });

  app.post<{
    Body: {
      code?: string;
      buyer_email?: string;
      order_id?: string;
      gross_amount_cents?: number;
    };
  }>(`${ADMIN_ROUTE_PREFIX}/affiliate/conversion/confirm`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.AFFILIATE_MANAGE
    );
    if (!adminAccess) {
      return;
    }

    const code = request.body?.code?.trim().toUpperCase();
    const buyerEmail = normalizeEmail(request.body?.buyer_email);
    const orderId = request.body?.order_id?.trim() || randomUUID();
    const grossAmount = Math.max(0, request.body?.gross_amount_cents ?? 0);
    if (!code || !buyerEmail || grossAmount <= 0) {
      return reply.code(400).send({ error: "code, buyer_email and gross_amount_cents are required" });
    }

    const result = await recordAffiliatePaidConversion(code, buyerEmail, orderId, grossAmount);
    if (!result.ok) {
      return reply.code(result.code).send({ error: result.error });
    }

    return {
      ok: true,
      conversion_id: result.conversionId,
      commission_amount_cents: result.commissionAmountCents
    };
  });

  app.get("/affiliate/dashboard", async (request, reply) => {
    const auth = requireAuth(request, reply);
    if (!auth) {
      return;
    }

    const snapshot = store.snapshot();
    const codes = snapshot.affiliate_codes.filter((item) => item.user_id === auth.user.id);
    const conversions = snapshot.affiliate_conversions.filter(
      (item) => item.affiliate_user_id === auth.user.id
    );
    const payouts = snapshot.affiliate_payouts.filter(
      (item) => item.affiliate_user_id === auth.user.id
    );

    const pendingCommission = conversions
      .filter((item) => item.status === "paid_confirmed" && item.payout_id === null)
      .reduce((sum, item) => sum + item.commission_amount_cents, 0);

    const paidCommission = payouts
      .filter((item) => item.status === "approved" || item.status === "paid")
      .reduce((sum, item) => sum + item.amount_cents, 0);

    return {
      ok: true,
      codes,
      summary: {
        conversions_total: conversions.length,
        pending_commission_cents: pendingCommission,
        paid_commission_cents: paidCommission
      }
    };
  });

  app.post<{
    Body: { affiliate_user_id?: string; payout_reference?: string };
  }>(`${ADMIN_ROUTE_PREFIX}/affiliate/payout/approve`, async (request, reply) => {
    const adminAccess = await requireAdminPermission(
      request,
      reply,
      ADMIN_PERMISSION_KEYS.AFFILIATE_MANAGE
    );
    if (!adminAccess) {
      return;
    }
    const affiliateUserId = request.body?.affiliate_user_id?.trim();
    const payoutReference = request.body?.payout_reference?.trim() || null;
    if (!affiliateUserId) {
      return reply.code(400).send({ error: "affiliate_user_id is required" });
    }

    const snapshot = store.snapshot();
    const pending = snapshot.affiliate_conversions.filter(
      (item) =>
        item.affiliate_user_id === affiliateUserId &&
        item.status === "paid_confirmed" &&
        item.payout_id === null
    );
    if (pending.length === 0) {
      return reply.code(400).send({ error: "no pending affiliate commission for user" });
    }

    const amountCents = pending.reduce((sum, item) => sum + item.commission_amount_cents, 0);
    const periodStart = pending
      .map((item) => item.created_at)
      .sort((a, b) => a.localeCompare(b))[0];
    const periodEnd = pending
      .map((item) => item.created_at)
      .sort((a, b) => b.localeCompare(a))[0];
    const payoutId = randomUUID();

    await store.update((state) => {
      state.affiliate_payouts.push({
        id: payoutId,
        affiliate_user_id: affiliateUserId,
        period_start: periodStart,
        period_end: periodEnd,
        amount_cents: amountCents,
        status: "approved",
        payout_reference: payoutReference,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      for (const conversion of state.affiliate_conversions) {
        if (
          conversion.affiliate_user_id === affiliateUserId &&
          conversion.status === "paid_confirmed" &&
          conversion.payout_id === null
        ) {
          conversion.payout_id = payoutId;
        }
      }
    });

    return { ok: true, payout_id: payoutId, amount_cents: amountCents };
  });
}

interface GrantSubscriptionInput {
  userId: string;
  planId: PaidPlanTier;
  moduleScope: ModuleScope;
  years: number;
  source: "stripe" | "offline" | "manual";
  teamId?: string | null;
}

async function grantSubscriptionByEmail(input: {
  email: string;
  planId: PaidPlanTier;
  moduleScope: ModuleScope;
  years: number;
  source: "stripe" | "offline" | "manual";
  teamId?: string | null;
}): Promise<{ userId: string; endsAt: string }> {
  let userId = "";
  let endsAt = "";

  await store.update((state) => {
    const nowIso = new Date().toISOString();
    let user = state.users.find((item) => item.email === input.email);
    if (!user) {
      user = {
        id: randomUUID(),
        email: input.email,
        created_at: nowIso,
        last_login_at: nowIso
      };
      state.users.push(user);
    } else {
      user.last_login_at = nowIso;
    }

    userId = user.id;
    endsAt = applySubscriptionGrant(state, {
      userId: user.id,
      planId: input.planId,
      moduleScope: input.moduleScope,
      years: input.years,
      source: input.source,
      teamId: input.teamId ?? null
    });
  });

  return { userId, endsAt };
}

async function grantSubscriptionByUserId(input: GrantSubscriptionInput): Promise<{ endsAt: string }> {
  let endsAt = "";
  await store.update((state) => {
    const user = state.users.find((item) => item.id === input.userId);
    if (!user) {
      throw new Error("user not found");
    }
    user.last_login_at = new Date().toISOString();
    endsAt = applySubscriptionGrant(state, input);
  });
  return { endsAt };
}

function applySubscriptionGrant(state: StoreState, input: GrantSubscriptionInput): string {
  const now = new Date();
  const nowIso = now.toISOString();
  const endsAt = addYears(now, input.years).toISOString();
  const refundEndsAt = addDays(now, REFUND_WINDOW_DAYS).toISOString();

  state.subscriptions = state.subscriptions.map((item) =>
    item.user_id === input.userId && item.status === "active"
      ? { ...item, status: "expired" as const }
      : item
  );

  state.subscriptions.push({
    id: randomUUID(),
    user_id: input.userId,
    plan_id: input.planId,
    team_id: input.teamId ?? null,
    status: "active",
    starts_at: nowIso,
    ends_at: endsAt,
    revoked_at: null,
    refund_window_ends_at: refundEndsAt,
    source: input.source,
    created_at: nowIso
  });

  const narrateEnabled = input.moduleScope === "narrate" || input.moduleScope === "bundle";
  const memorybankEnabled = input.moduleScope === "memorybank" || input.moduleScope === "bundle";

  state.product_entitlements = state.product_entitlements.map((item) =>
    item.user_id === input.userId && item.status === "active"
      ? { ...item, status: "expired" as const }
      : item
  );

  state.product_entitlements.push({
    id: randomUUID(),
    user_id: input.userId,
    narrate_enabled: narrateEnabled,
    memorybank_enabled: memorybankEnabled,
    bundle_enabled: input.moduleScope === "bundle",
    starts_at: nowIso,
    ends_at: endsAt,
    status: "active",
    created_at: nowIso
  });

  ensureQuotaRecord(state, input.userId, input.planId);
  return endsAt;
}

function generateCode(prefix: string): string {
  const chunk = () => randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${chunk()}-${chunk()}-${chunk()}`;
}

function clampCommissionRate(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_AFFILIATE_RATE_BPS;
  }
  return Math.max(100, Math.min(3000, Math.floor(value)));
}

async function recordAffiliatePaidConversion(
  code: string,
  buyerEmail: string,
  orderId: string,
  grossAmountCents: number
): Promise<
  | { ok: true; conversionId: string; commissionAmountCents: number }
  | { ok: false; code: number; error: string }
> {
  const snapshot = store.snapshot();
  const affiliate = snapshot.affiliate_codes.find(
    (item) => item.code === code && item.status === "active"
  );
  if (!affiliate) {
    return { ok: false, code: 404, error: "affiliate code not found" };
  }
  const existingOrder = snapshot.affiliate_conversions.find((item) => item.order_id === orderId);
  if (existingOrder) {
    return {
      ok: true,
      conversionId: existingOrder.id,
      commissionAmountCents: existingOrder.commission_amount_cents
    };
  }

  let conversionId = "";
  let commissionAmountCents = 0;
  await store.update((state) => {
    let buyer = state.users.find((item) => item.email === buyerEmail);
    if (!buyer) {
      buyer = {
        id: randomUUID(),
        email: buyerEmail,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };
      state.users.push(buyer);
    }
    const currentAffiliate = state.affiliate_codes.find(
      (item) => item.code === code && item.status === "active"
    );
    if (!currentAffiliate) {
      throw new Error("affiliate code not found");
    }

    conversionId = randomUUID();
    commissionAmountCents = Math.floor(
      (grossAmountCents * currentAffiliate.commission_rate_bps) / 10000
    );
    state.affiliate_conversions.push({
      id: conversionId,
      affiliate_user_id: currentAffiliate.user_id,
      buyer_user_id: buyer.id,
      ref_code: code,
      status: "paid_confirmed",
      order_id: orderId,
      gross_amount_cents: grossAmountCents,
      commission_amount_cents: commissionAmountCents,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      payout_id: null
    });
  });

  return { ok: true, conversionId, commissionAmountCents };
}

function canManageTeamRole(
  role: StoreState["team_memberships"][number]["role"]
): boolean {
  return role === "owner" || role === "manager";
}

function resolveTeamAccessForUser(
  state: StoreState,
  userId: string,
  teamKey: string | undefined,
  requireManagement: boolean
):
  | {
      team: StoreState["teams"][number];
      membership: StoreState["team_memberships"][number];
    }
  | undefined {
  const activeMemberships = state.team_memberships.filter(
    (item) => item.user_id === userId && item.status === "active" && item.revoked_at === null
  );
  if (activeMemberships.length === 0) {
    return undefined;
  }

  let membership: StoreState["team_memberships"][number] | undefined;
  if (teamKey) {
    const team = state.teams.find((item) => item.team_key === teamKey);
    if (!team) {
      return undefined;
    }
    membership = activeMemberships.find((item) => item.team_id === team.id);
  } else {
    membership = [...activeMemberships].sort((a, b) => {
      const rankDiff = teamRoleRank(a.role) - teamRoleRank(b.role);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return b.created_at.localeCompare(a.created_at);
    })[0];
  }

  if (!membership) {
    return undefined;
  }
  if (requireManagement && !canManageTeamRole(membership.role)) {
    return undefined;
  }

  const team = state.teams.find((item) => item.id === membership.team_id);
  if (!team) {
    return undefined;
  }
  return { team, membership };
}

function buildTeamStatusPayload(
  state: StoreState,
  team: StoreState["teams"][number]
): {
  team: StoreState["teams"][number];
  seats: { used: number; limit: number; remaining: number };
  members: Array<StoreState["team_memberships"][number] & { email: string | null }>;
} {
  const members = state.team_memberships
    .filter((item) => item.team_id === team.id)
    .map((item) => ({
      ...item,
      email: state.users.find((user) => user.id === item.user_id)?.email ?? item.invited_email
    }));
  const activeSeats = members.filter((item) => item.status === "active").length;

  return {
    team,
    seats: {
      used: activeSeats,
      limit: team.seat_limit,
      remaining: Math.max(0, team.seat_limit - activeSeats)
    },
    members
  };
}

function teamRoleRank(role: StoreState["team_memberships"][number]["role"]): number {
  if (role === "owner") {
    return 0;
  }
  if (role === "manager") {
    return 1;
  }
  return 2;
}

function normalizeSupportCategory(
  value: string | undefined
): "support" | "billing" | "bug" | "feature" | undefined {
  const candidate = value?.trim().toLowerCase();
  if (
    candidate === "support" ||
    candidate === "billing" ||
    candidate === "bug" ||
    candidate === "feature"
  ) {
    return candidate;
  }
  return undefined;
}

function normalizeSupportSeverity(
  value: string | undefined
): "low" | "medium" | "high" | undefined {
  const candidate = value?.trim().toLowerCase();
  if (candidate === "low" || candidate === "medium" || candidate === "high") {
    return candidate;
  }
  return undefined;
}

function hasActiveTeamSeat(state: StoreState, teamId: string, userId: string): boolean {
  return state.team_memberships.some(
    (item) =>
      item.team_id === teamId &&
      item.user_id === userId &&
      item.status === "active" &&
      item.revoked_at === null
  );
}

function resolveProviderPolicy(
  state: StoreState,
  userId: string,
  teamId: string | null
): EntitlementClaimPayload["provider_policy"] {
  const userPolicy = state.provider_policies.find(
    (item) => item.scope_type === "user" && item.scope_id === userId
  );
  if (userPolicy) {
    return {
      local_only: userPolicy.local_only,
      byo_allowed: userPolicy.byo_allowed,
      allowlist: [...userPolicy.allowlist],
      denylist: [...userPolicy.denylist]
    };
  }

  if (teamId) {
    const teamPolicy = state.provider_policies.find(
      (item) => item.scope_type === "team" && item.scope_id === teamId
    );
    if (teamPolicy) {
      return {
        local_only: teamPolicy.local_only,
        byo_allowed: teamPolicy.byo_allowed,
        allowlist: [...teamPolicy.allowlist],
        denylist: [...teamPolicy.denylist]
      };
    }
  }

  return {
    local_only: false,
    byo_allowed: true,
    allowlist: [],
    denylist: []
  };
}

function normalizePolicyInput(input: {
  local_only?: boolean;
  byo_allowed?: boolean;
  allowlist?: string[];
  denylist?: string[];
}): EntitlementClaimPayload["provider_policy"] {
  return {
    local_only: Boolean(input.local_only),
    byo_allowed: input.byo_allowed ?? true,
    allowlist: normalizeHostList(input.allowlist),
    denylist: normalizeHostList(input.denylist)
  };
}

function normalizeHostList(list: string[] | undefined): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

async function upsertProviderPolicy(
  scopeType: "user" | "team",
  scopeId: string,
  policy: EntitlementClaimPayload["provider_policy"]
): Promise<void> {
  await store.update((state) => {
    const existing = state.provider_policies.find(
      (item) => item.scope_type === scopeType && item.scope_id === scopeId
    );
    if (existing) {
      existing.local_only = policy.local_only;
      existing.byo_allowed = policy.byo_allowed;
      existing.allowlist = [...policy.allowlist];
      existing.denylist = [...policy.denylist];
      existing.updated_at = new Date().toISOString();
      return;
    }
    state.provider_policies.push({
      id: randomUUID(),
      scope_type: scopeType,
      scope_id: scopeId,
      local_only: policy.local_only,
      byo_allowed: policy.byo_allowed,
      allowlist: [...policy.allowlist],
      denylist: [...policy.denylist],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  });
}

function supportsGovernancePlan(plan: PlanTier): boolean {
  if (plan === "team" || plan === "enterprise") {
    return true;
  }
  return plan === "pro" && GOVERNANCE_ALLOW_PRO;
}

function resolveGovernanceContextForUser(
  state: StoreState,
  userId: string,
  teamKey: string | undefined,
  requireManage: boolean
):
  | {
      scopeType: "user" | "team";
      scopeId: string;
      plan: PlanTier;
      canManage: boolean;
      team: StoreState["teams"][number] | null;
    }
  | undefined {
  if (teamKey) {
    const access = resolveTeamAccessForUser(state, userId, teamKey, false);
    if (!access) {
      return undefined;
    }
    const canManage = canManageTeamRole(access.membership.role);
    if (requireManage && !canManage) {
      return undefined;
    }
    if (!supportsGovernancePlan(access.team.plan_id)) {
      return undefined;
    }
    return {
      scopeType: "team",
      scopeId: access.team.id,
      plan: access.team.plan_id,
      canManage,
      team: access.team
    };
  }

  const planState = resolveEffectivePlan(state, userId, new Date());
  if (!supportsGovernancePlan(planState.plan)) {
    return undefined;
  }
  return {
    scopeType: "user",
    scopeId: userId,
    plan: planState.plan,
    canManage: true,
    team: null
  };
}

function getGovernanceSettingsForScope(
  state: StoreState,
  scopeType: "user" | "team",
  scopeId: string
): StoreState["governance_settings"][number] | undefined {
  return state.governance_settings.find(
    (item) => item.scope_type === scopeType && item.scope_id === scopeId
  );
}

function buildDefaultGovernanceSettings(
  scopeType: "user" | "team",
  scopeId: string,
  nowIso: string
): StoreState["governance_settings"][number] {
  return {
    id: `default-${scopeType}-${scopeId}`,
    scope_type: scopeType,
    scope_id: scopeId,
    slack_enabled: false,
    slack_addon_active: false,
    slack_channel: null,
    vote_mode: "majority",
    max_debate_chars: GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS,
    retention_days: GOVERNANCE_DEFAULT_RETENTION_DAYS,
    created_at: nowIso,
    updated_at: nowIso
  };
}

function upsertGovernanceSettings(
  state: StoreState,
  scopeType: "user" | "team",
  scopeId: string,
  patch: {
    slack_enabled?: boolean;
    slack_channel?: string | null;
    vote_mode?: "majority" | "single_reviewer";
    retention_days?: number;
    max_debate_chars?: number;
  }
): StoreState["governance_settings"][number] {
  const nowIso = new Date().toISOString();
  let settings = getGovernanceSettingsForScope(state, scopeType, scopeId);
  if (!settings) {
    settings = {
      ...buildDefaultGovernanceSettings(scopeType, scopeId, nowIso),
      id: randomUUID()
    };
    state.governance_settings.push(settings);
  }

  if (patch.vote_mode !== undefined) {
    settings.vote_mode = patch.vote_mode;
  }
  if (patch.retention_days !== undefined) {
    settings.retention_days = clampInt(
      Math.floor(patch.retention_days),
      GOVERNANCE_MIN_RETENTION_DAYS,
      GOVERNANCE_MAX_RETENTION_DAYS
    );
  }
  if (patch.max_debate_chars !== undefined) {
    settings.max_debate_chars = clampInt(
      Math.floor(patch.max_debate_chars),
      GOVERNANCE_MIN_DEBATE_CHARS,
      GOVERNANCE_MAX_DEBATE_CHARS
    );
  }
  if (patch.slack_channel !== undefined) {
    const channel = patch.slack_channel?.trim() || null;
    if (channel && channel.length > 120) {
      throw new Error("slack_channel is too long");
    }
    settings.slack_channel = channel;
  }
  if (patch.slack_enabled !== undefined) {
    if (patch.slack_enabled && !settings.slack_addon_active) {
      throw new Error("slack add-on is not active for this scope");
    }
    settings.slack_enabled = patch.slack_enabled;
  }
  if (!settings.slack_addon_active && settings.slack_enabled) {
    settings.slack_enabled = false;
  }
  settings.updated_at = nowIso;
  return settings;
}

function setGovernanceSlackAddonState(
  state: StoreState,
  scopeType: "user" | "team",
  scopeId: string,
  active: boolean
): StoreState["governance_settings"][number] {
  const settings = upsertGovernanceSettings(state, scopeType, scopeId, {});
  settings.slack_addon_active = active;
  if (!active) {
    settings.slack_enabled = false;
  }
  settings.updated_at = new Date().toISOString();
  return settings;
}

function normalizeGovernanceVoteMode(
  value: string | undefined
): "majority" | "single_reviewer" | undefined {
  const candidate = value?.trim().toLowerCase();
  if (candidate === "majority" || candidate === "single_reviewer") {
    return candidate;
  }
  return undefined;
}

function normalizeMastermindEntryType(
  value: string | undefined
): "argument" | "suggestion" | "review" | undefined {
  const candidate = value?.trim().toLowerCase();
  if (candidate === "argument" || candidate === "suggestion" || candidate === "review") {
    return candidate;
  }
  return undefined;
}

function normalizeMastermindDecision(
  value: string | undefined
): "approve" | "reject" | "needs_change" | undefined {
  const candidate = value?.trim().toLowerCase();
  if (candidate === "approve" || candidate === "reject" || candidate === "needs_change") {
    return candidate;
  }
  return undefined;
}

function normalizeStringList(
  list: string[] | undefined,
  maxItems: number,
  maxLength: number
): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  const unique = new Set<string>();
  for (const raw of list) {
    const value = raw.trim();
    if (!value) {
      continue;
    }
    if (value.length > maxLength) {
      throw new Error(`list item exceeds maximum length of ${maxLength}`);
    }
    unique.add(value);
    if (unique.size >= maxItems) {
      break;
    }
  }
  return Array.from(unique);
}

function normalizeIsoDateOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const candidate = value.trim();
  if (!candidate) {
    return null;
  }
  const time = Date.parse(candidate);
  if (!Number.isFinite(time)) {
    throw new Error("invalid date value");
  }
  return new Date(time).toISOString();
}

function parseMastermindOptionsInput(
  options: Array<{ option_key?: string; title?: string; rationale?: string | null }> | undefined,
  maxDebateChars: number
): Array<{ option_key: string; title: string; rationale: string | null }> {
  if (!Array.isArray(options)) {
    return [];
  }
  const normalized: Array<{ option_key: string; title: string; rationale: string | null }> = [];
  const seenKeys = new Set<string>();
  for (let index = 0; index < options.length; index += 1) {
    const candidate = options[index];
    const fallbackKey = `option-${index + 1}`;
    const optionKey = normalizeMastermindOptionKey(candidate.option_key, fallbackKey);
    if (seenKeys.has(optionKey)) {
      throw new Error(`duplicate option_key: ${optionKey}`);
    }
    seenKeys.add(optionKey);
    const title = candidate.title?.trim();
    if (!title) {
      throw new Error("each option requires title");
    }
    if (title.length > 180) {
      throw new Error("option title is too long");
    }
    const rationale = candidate.rationale?.trim() || null;
    if (rationale && rationale.length > maxDebateChars) {
      throw new Error(`option rationale exceeds max_debate_chars (${maxDebateChars})`);
    }
    normalized.push({
      option_key: optionKey,
      title,
      rationale
    });
  }
  return normalized.slice(0, 12);
}

function normalizeMastermindOptionKey(raw: string | undefined, fallback: string): string {
  const value = (raw ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (value.length < 2) {
    return fallback;
  }
  return value.slice(0, 40);
}

function canAccessGovernanceThread(
  state: StoreState,
  thread: StoreState["mastermind_threads"][number],
  userId: string
): boolean {
  if (thread.team_id) {
    if (hasActiveTeamSeat(state, thread.team_id, userId)) {
      return true;
    }
  }
  if (thread.created_by_user_id === userId) {
    return true;
  }
  return (
    state.mastermind_entries.some((entry) => entry.thread_id === thread.id && entry.user_id === userId) ||
    state.mastermind_votes.some((vote) => vote.thread_id === thread.id && vote.user_id === userId)
  );
}

function canFinalizeGovernanceThread(
  state: StoreState,
  thread: StoreState["mastermind_threads"][number],
  userId: string
): boolean {
  if (!thread.team_id) {
    return thread.created_by_user_id === userId;
  }
  const membership = state.team_memberships.find(
    (item) =>
      item.team_id === thread.team_id &&
      item.user_id === userId &&
      item.status === "active" &&
      item.revoked_at === null
  );
  if (!membership) {
    return false;
  }
  return canManageTeamRole(membership.role);
}

function resolveGovernanceSettingsForThread(
  state: StoreState,
  thread: StoreState["mastermind_threads"][number],
  fallbackUserId: string
): StoreState["governance_settings"][number] {
  const nowIso = new Date().toISOString();
  if (thread.team_id) {
    return (
      getGovernanceSettingsForScope(state, "team", thread.team_id) ??
      buildDefaultGovernanceSettings("team", thread.team_id, nowIso)
    );
  }
  const scopeUserId = thread.created_by_user_id || fallbackUserId;
  return (
    getGovernanceSettingsForScope(state, "user", scopeUserId) ??
    buildDefaultGovernanceSettings("user", scopeUserId, nowIso)
  );
}

function buildMastermindVoteTally(
  state: StoreState,
  threadId: string
): Array<{ option_key: string; title: string; votes: number; weight: number }> {
  const options = state.mastermind_options.filter((item) => item.thread_id === threadId);
  const tally = new Map<string, { votes: number; weight: number; title: string }>();
  for (const option of options) {
    tally.set(option.option_key, { votes: 0, weight: 0, title: option.title });
  }
  for (const vote of state.mastermind_votes.filter((item) => item.thread_id === threadId)) {
    const bucket = tally.get(vote.option_key);
    if (!bucket) {
      continue;
    }
    bucket.votes += 1;
    bucket.weight += vote.weight;
  }
  return Array.from(tally.entries())
    .map(([option_key, value]) => ({
      option_key,
      title: value.title,
      votes: value.votes,
      weight: value.weight
    }))
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      if (b.votes !== a.votes) {
        return b.votes - a.votes;
      }
      return a.option_key.localeCompare(b.option_key);
    });
}

function chooseWinningOptionFromVotes(state: StoreState, threadId: string): string | undefined {
  return buildMastermindVoteTally(state, threadId)[0]?.option_key;
}

function buildMastermindThreadDetail(
  state: StoreState,
  thread: StoreState["mastermind_threads"][number]
): {
  thread: StoreState["mastermind_threads"][number];
  options: StoreState["mastermind_options"];
  entries: StoreState["mastermind_entries"];
  votes: StoreState["mastermind_votes"];
  tally: Array<{ option_key: string; title: string; votes: number; weight: number }>;
  outcome: StoreState["mastermind_outcomes"][number] | null;
} {
  const options = state.mastermind_options
    .filter((item) => item.thread_id === thread.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const entries = state.mastermind_entries
    .filter((item) => item.thread_id === thread.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const votes = state.mastermind_votes
    .filter((item) => item.thread_id === thread.id)
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const outcome =
    state.mastermind_outcomes
      .filter((item) => item.thread_id === thread.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  return {
    thread,
    options,
    entries,
    votes,
    tally: buildMastermindVoteTally(state, thread.id),
    outcome
  };
}

function createGovernanceDecisionEvent(
  state: StoreState,
  thread: StoreState["mastermind_threads"][number],
  outcome: StoreState["mastermind_outcomes"][number],
  retentionDays: number
): void {
  const now = new Date();
  const nowIso = now.toISOString();
  const sequence =
    state.governance_decision_events.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
  const eventId = randomUUID();
  const summary = `${outcome.title} -> ${outcome.decision}${
    outcome.winning_option_key ? ` (${outcome.winning_option_key})` : ""
  }`;
  state.governance_decision_events.push({
    id: eventId,
    sequence,
    event_type: "decision_finalized",
    thread_id: thread.id,
    team_id: thread.team_id,
    decision: outcome.decision,
    winning_option_key: outcome.winning_option_key,
    summary,
    created_at: nowIso,
    expires_at: addDays(now, clampInt(retentionDays, 1, 365)).toISOString()
  });

  const recipients = new Set<string>();
  recipients.add(thread.created_by_user_id);
  for (const entry of state.mastermind_entries) {
    if (entry.thread_id === thread.id) {
      recipients.add(entry.user_id);
    }
  }
  for (const vote of state.mastermind_votes) {
    if (vote.thread_id === thread.id) {
      recipients.add(vote.user_id);
    }
  }
  if (thread.team_id) {
    for (const membership of state.team_memberships) {
      if (
        membership.team_id === thread.team_id &&
        membership.status === "active" &&
        membership.revoked_at === null
      ) {
        recipients.add(membership.user_id);
      }
    }
  }

  for (const userId of recipients) {
    state.governance_decision_acks.push({
      id: randomUUID(),
      event_id: eventId,
      user_id: userId,
      status: "pending",
      note: null,
      updated_at: nowIso,
      acked_at: null
    });
  }
}

function pruneGovernanceState(state: StoreState): void {
  const nowMs = Date.now();
  state.governance_eod_reports = state.governance_eod_reports.filter((report) => {
    const retentionDays = resolveGovernanceRetentionDaysForScope(
      state,
      report.team_id ? "team" : "user",
      report.team_id ?? report.user_id
    );
    const reference = new Date(report.updated_at || report.created_at).getTime();
    const expiresMs = addDays(new Date(reference), retentionDays).getTime();
    return expiresMs > nowMs;
  });

  const staleThreadIds = new Set(
    state.mastermind_threads
      .filter((thread) => new Date(thread.expires_at).getTime() <= nowMs)
      .map((thread) => thread.id)
  );
  if (staleThreadIds.size > 0) {
    state.mastermind_threads = state.mastermind_threads.filter((thread) => !staleThreadIds.has(thread.id));
    state.mastermind_options = state.mastermind_options.filter((option) => !staleThreadIds.has(option.thread_id));
    state.mastermind_entries = state.mastermind_entries.filter((entry) => !staleThreadIds.has(entry.thread_id));
    state.mastermind_votes = state.mastermind_votes.filter((vote) => !staleThreadIds.has(vote.thread_id));
  }

  const activeEventIds = new Set<string>();
  state.governance_decision_events = state.governance_decision_events.filter((event) => {
    const keep = new Date(event.expires_at).getTime() > nowMs;
    if (keep) {
      activeEventIds.add(event.id);
    }
    return keep;
  });
  state.governance_decision_acks = state.governance_decision_acks.filter((ack) =>
    activeEventIds.has(ack.event_id)
  );
}

function resolveGovernanceRetentionDaysForScope(
  state: StoreState,
  scopeType: "user" | "team",
  scopeId: string
): number {
  const settings = getGovernanceSettingsForScope(state, scopeType, scopeId);
  if (!settings) {
    return GOVERNANCE_DEFAULT_RETENTION_DAYS;
  }
  return clampInt(
    settings.retention_days,
    GOVERNANCE_MIN_RETENTION_DAYS,
    GOVERNANCE_MAX_RETENTION_DAYS
  );
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function parseStripePriceMap(raw: string): Record<string, string> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        mapped[key.trim().toLowerCase()] = value.trim();
      }
    }
    return mapped;
  } catch {
    return {};
  }
}

function parseOriginList(raw: string | undefined, fallbackOrigin: string): string[] {
  const candidates = (raw ?? fallbackOrigin)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const validOrigins = new Set<string>();
  for (const candidate of candidates) {
    try {
      const origin = new URL(candidate).origin;
      validOrigins.add(origin);
    } catch {
      // Ignore malformed origins and keep validating the rest.
    }
  }
  try {
    validOrigins.add(new URL(fallbackOrigin).origin);
  } catch {
    // Keep derived values only.
  }
  return Array.from(validOrigins);
}

function resolveStripePriceId(planId: PaidPlanTier, moduleScope: ModuleScope): string | undefined {
  return STRIPE_PRICE_MAP[`${planId}:${moduleScope}`.toLowerCase()];
}

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",").map((item) => item.trim());
  const timestamp = parts.find((item) => item.startsWith("t="))?.slice(2);
  const signatures = parts.filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");

  const hasMatch = signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "utf8");
    if (candidateBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });
  if (!hasMatch) {
    return false;
  }

  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  return ageSeconds <= 300;
}

function verifySlackRequestSignature(
  request: FastifyRequest,
  rawBody: string,
  signingSecret: string
): boolean {
  if (!rawBody) {
    return false;
  }
  const timestampHeader = request.headers["x-slack-request-timestamp"];
  const signatureHeader = request.headers["x-slack-signature"];
  const timestampRaw = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
  const signatureRaw = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!timestampRaw || !signatureRaw || !signatureRaw.startsWith("v0=")) {
    return false;
  }
  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > SLACK_REQUEST_MAX_AGE_SECONDS) {
    return false;
  }
  const basestring = `v0:${timestampRaw}:${rawBody}`;
  const expected = createHmac("sha256", signingSecret).update(basestring).digest("hex");
  const provided = signatureRaw.slice(3);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

async function resolveSlackUserEmail(slackUserId: string): Promise<string | null> {
  if (!SLACK_BOT_TOKEN || !slackUserId) {
    return null;
  }
  try {
    const response = await fetch(
      `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`
        }
      }
    );
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok || payload.ok !== true) {
      return null;
    }
    const user = payload.user && typeof payload.user === "object" ? payload.user : null;
    const profile =
      user && "profile" in (user as Record<string, unknown>)
        ? (user as Record<string, unknown>).profile
        : null;
    const email =
      profile && typeof profile === "object"
        ? normalizeEmail((profile as Record<string, unknown>).email as string | undefined)
        : undefined;
    return email ?? null;
  } catch (error) {
    app.log.warn({ error: toErrorMessage(error), slack_user_id: slackUserId }, "Slack user lookup failed");
    return null;
  }
}

async function dispatchSlackGovernanceNotification(
  settings: StoreState["governance_settings"][number],
  text: string
): Promise<void> {
  if (!settings.slack_enabled || !settings.slack_addon_active) {
    return;
  }
  const channel = settings.slack_channel?.trim() || undefined;
  if (SLACK_BOT_TOKEN && channel) {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ channel, text })
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok || payload.ok !== true) {
      throw new Error("Slack chat.postMessage failed");
    }
    return;
  }
  if (SLACK_WEBHOOK_URL) {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(channel ? { text, channel } : { text })
    });
    if (!response.ok) {
      throw new Error(`Slack webhook failed (${response.status})`);
    }
  }
}

function buildSlackHelpText(): string {
  return [
    "PG commands:",
    "- `summary`",
    "- `eod <title> :: <summary>`",
    "- `thread <title> :: <question> :: <option1|option2|...>`",
    "- `vote <thread_id> <option_key> [rationale]` (team vote step)",
    "- `decide <thread_id> <approve|reject|needs_change> [option_key] [note]` (owner/manager final step)"
  ].join("\n");
}

function isSlackHelpCommand(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  const [actionRaw] = trimmed.split(/\s+/);
  return (actionRaw || "").toLowerCase() === "help";
}

function getSlackCommandAction(text: string): SlackCommandAction | "unknown" {
  const trimmed = text.trim();
  if (!trimmed) {
    return "help";
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "help";
  }
  const normalized =
    parts[0].toLowerCase() === "pg" ? (parts[1] || "help").toLowerCase() : parts[0].toLowerCase();
  if (
    normalized === "help" ||
    normalized === "summary" ||
    normalized === "eod" ||
    normalized === "thread" ||
    normalized === "vote" ||
    normalized === "decide"
  ) {
    return normalized;
  }
  return "unknown";
}

async function postSlackResponse(
  responseUrl: string,
  response: SlackEphemeralResponse
): Promise<void> {
  const postOnce = async (
    payload: SlackEphemeralResponse
  ): Promise<{ ok: boolean; status: number; body: string }> => {
    const result = await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return {
      ok: result.ok,
      status: result.status,
      body: await result.text()
    };
  };

  const initial = await postOnce(response);
  if (initial.ok) {
    return;
  }

  if (response.blocks && response.blocks.length > 0) {
    const fallbackPayload: SlackEphemeralResponse = {
      response_type: "ephemeral",
      text: response.text,
      replace_original: response.replace_original
    };
    const fallback = await postOnce(fallbackPayload);
    if (fallback.ok) {
      app.log.warn(
        {
          status: initial.status,
          response_body: initial.body.slice(0, 400)
        },
        "Slack response_url rejected rich payload; delivered plain-text fallback"
      );
      return;
    }
    throw new Error(
      `Slack response_url post failed (${fallback.status})`
    );
  }

  throw new Error(`Slack response_url post failed (${initial.status})`);
}

async function postSlackActionFollowup(
  responseUrl: string | null,
  payload: Record<string, unknown>,
  response: SlackEphemeralResponse
): Promise<void> {
  if (responseUrl) {
    await postSlackResponse(responseUrl, response);
    return;
  }

  if (!SLACK_BOT_TOKEN) {
    throw new Error("SLACK_BOT_TOKEN is required to post action follow-up without response_url.");
  }

  const channelId =
    getString(getObject(payload, ["channel"]), "id") ??
    getString(getObject(payload, ["container"]), "channel_id");
  const slackUserId = getString(getObject(payload, ["user"]), "id");
  if (!channelId || !slackUserId) {
    throw new Error("Missing channel/user in Slack action payload for async follow-up.");
  }

  const body: Record<string, unknown> = {
    channel: channelId,
    user: slackUserId,
    text: response.text
  };
  if (Array.isArray(response.blocks) && response.blocks.length > 0) {
    body.blocks = response.blocks;
  }

  const result = await fetch("https://slack.com/api/chat.postEphemeral", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  });

  let parsed: { ok?: boolean; error?: string } | null = null;
  try {
    parsed = (await result.json()) as { ok?: boolean; error?: string };
  } catch {
    parsed = null;
  }
  if (!result.ok || !parsed?.ok) {
    throw new Error(`Slack chat.postEphemeral failed: ${parsed?.error ?? result.status}`);
  }
}

async function processSlackCommandAsync(
  responseUrl: string,
  slackUserId: string,
  text: string
): Promise<void> {
  try {
    const action = getSlackCommandAction(text);
    const userEmail = await resolveSlackUserEmail(slackUserId);
    if (!userEmail) {
      await postSlackResponse(responseUrl, {
        response_type: "ephemeral",
        text: "Could not resolve your Slack email. Ensure Slack bot scope includes `users:read.email`."
      });
      return;
    }

    if (SLACK_ALLOWED_EMAILS.size > 0 && !SLACK_ALLOWED_EMAILS.has(userEmail)) {
      await postSlackResponse(responseUrl, {
        response_type: "ephemeral",
        text: `Email ${userEmail} is not authorized for Slack governance commands.`
      });
      return;
    }

    const existingUser = findUserByEmail(userEmail);
    const createIfMissing = action === "eod" || action === "thread" || action === "vote";
    if (!existingUser && !createIfMissing) {
      await postSlackResponse(responseUrl, {
        response_type: "ephemeral",
        text: "No linked account found for your Slack email. Sign in once at the web portal, then retry."
      });
      return;
    }
    const user =
      existingUser ??
      (await getOrCreateUserByEmail(userEmail, { touchLastLogin: false, createIfMissing }));
    const payload = await executeSlackGovernanceCommand(user, text);
    await postSlackResponse(responseUrl, payload);
  } catch (error) {
    app.log.error({ error: toErrorMessage(error) }, "Async Slack command execution failed");
    try {
      await postSlackResponse(responseUrl, {
        response_type: "ephemeral",
        text: `Slack command failed: ${toErrorMessage(error)}`
      });
    } catch (postError) {
      app.log.error({ error: toErrorMessage(postError) }, "Failed posting async Slack error response");
    }
  }
}

async function processSlackActionAsync(
  responseUrl: string | null,
  payload: Record<string, unknown>,
  actionId: string,
  action: Record<string, unknown>
): Promise<void> {
  try {
    const user = await resolveSlackPayloadUser(payload);
    if (!user) {
      await postSlackActionFollowup(responseUrl, payload, {
        response_type: "ephemeral",
        text: "Slack user is not authorized."
      });
      return;
    }
    const result = await executeSlackGovernanceAction(user, actionId, action);
    await postSlackActionFollowup(responseUrl, payload, result);
  } catch (error) {
    app.log.error({ error: toErrorMessage(error) }, "Async Slack action execution failed");
    try {
      await postSlackActionFollowup(responseUrl, payload, {
        response_type: "ephemeral",
        text: `Slack action failed: ${toErrorMessage(error)}`
      });
    } catch (postError) {
      app.log.error({ error: toErrorMessage(postError) }, "Failed posting async Slack action error response");
    }
  }
}

async function executeSlackGovernanceCommand(
  user: UserRecord,
  text: string
): Promise<SlackEphemeralResponse> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      response_type: "ephemeral",
      text: buildSlackHelpText()
    };
  }

  const commandParts = trimmed.split(/\s+/).filter(Boolean);
  if (commandParts[0]?.toLowerCase() === "pg") {
    commandParts.shift();
  }
  const [actionRaw, ...restParts] = commandParts;
  const action = (actionRaw || "").toLowerCase() as SlackCommandAction;
  const rest = restParts.join(" ").trim();

  if (action === "help") {
    return {
      response_type: "ephemeral",
      text: buildSlackHelpText()
    };
  }

  if (action === "summary") {
    const snapshot = store.snapshot();
    const claims = buildEntitlementClaims(snapshot, user.id, "slack-summary");
    const teamMemberships = snapshot.team_memberships.filter(
      (item) => item.user_id === user.id && item.status === "active" && item.revoked_at === null
    );
    const teamRoleLabels = teamMemberships
      .map((membership) => {
        const team = snapshot.teams.find((item) => item.id === membership.team_id);
        if (!team) {
          return null;
        }
        return `${team.team_key} (${membership.role})`;
      })
      .filter((item): item is string => Boolean(item));
    return {
      response_type: "ephemeral",
      text: `Email: ${user.email}\nPlan: ${claims.plan}\nModules: ${claims.modules.join(", ")}\nTeams: ${
        teamRoleLabels.length > 0 ? teamRoleLabels.join(", ") : "none"
      }`
    };
  }

  if (action === "eod") {
    const [title, summary] = rest.split("::").map((part) => part.trim());
    if (!title || !summary) {
      return {
        response_type: "ephemeral",
        text: "Usage: `eod <title> :: <summary>`"
      };
    }
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, user.id, undefined, false);
    if (!context) {
      return {
        response_type: "ephemeral",
        text: "No governance access found for this account (requires Pro+ with governance enabled or Team/Enterprise)."
      };
    }
    const reportId = randomUUID();
    let settings: StoreState["governance_settings"][number];
    await store.update((state) => {
      const liveContext = resolveGovernanceContextForUser(state, user.id, undefined, false);
      if (!liveContext) {
        throw new Error("governance context not found");
      }
      const nowIso = new Date().toISOString();
      state.governance_eod_reports.push({
        id: reportId,
        user_id: user.id,
        email: user.email,
        team_id: liveContext.scopeType === "team" ? liveContext.scopeId : null,
        title,
        summary,
        work_started_at: null,
        work_ended_at: null,
        changed_files: [],
        blockers: [],
        source: "human",
        agent_name: "slack",
        created_at: nowIso,
        updated_at: nowIso
      });
      settings =
        getGovernanceSettingsForScope(state, liveContext.scopeType, liveContext.scopeId) ??
        upsertGovernanceSettings(state, liveContext.scopeType, liveContext.scopeId, {});
      pruneGovernanceState(state);
    });
    if (settings!.slack_enabled && settings!.slack_addon_active) {
      await dispatchSlackGovernanceNotification(
        settings!,
        `*PG EOD submitted from Slack*\nBy: ${user.email}\nTitle: ${title}\nReport ID: ${reportId}`
      );
    }
    return {
      response_type: "ephemeral",
      text: `EOD saved. Report ID: ${reportId}`
    };
  }

  if (action === "thread") {
    const segments = rest.split("::").map((part) => part.trim());
    if (segments.length < 3) {
      return {
        response_type: "ephemeral",
        text: "Usage: `thread <title> :: <question> :: <option1|option2|...>`"
      };
    }
    const [title, question, rawOptions] = segments;
    const optionList = rawOptions
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    if (optionList.length < 2) {
      return {
        response_type: "ephemeral",
        text: "At least two options are required."
      };
    }
    const snapshot = store.snapshot();
    const context = resolveGovernanceContextForUser(snapshot, user.id, undefined, false);
    if (!context) {
      return {
        response_type: "ephemeral",
        text: "No governance access found for this account."
      };
    }

    const parsedOptions = optionList.map((label, index) => ({
      option_key: `opt${index + 1}`,
      title: label,
      rationale: null
    }));

    let threadId = "";
    let settings: StoreState["governance_settings"][number];
    await store.update((state) => {
      const liveContext = resolveGovernanceContextForUser(state, user.id, undefined, false);
      if (!liveContext) {
        throw new Error("governance context not found");
      }
      settings =
        getGovernanceSettingsForScope(state, liveContext.scopeType, liveContext.scopeId) ??
        upsertGovernanceSettings(state, liveContext.scopeType, liveContext.scopeId, {});
      if (question.length > settings.max_debate_chars) {
        throw new Error(`question exceeds max_debate_chars (${settings.max_debate_chars})`);
      }
      const now = new Date();
      const nowIso = now.toISOString();
      threadId = randomUUID();
      state.mastermind_threads.push({
        id: threadId,
        team_id: liveContext.scopeType === "team" ? liveContext.scopeId : null,
        created_by_user_id: user.id,
        created_by_email: user.email,
        title,
        question,
        status: "open",
        vote_mode: settings.vote_mode,
        decision: null,
        decision_option_key: null,
        decision_note: null,
        decided_by_user_id: null,
        decided_by_email: null,
        decided_at: null,
        last_activity_at: nowIso,
        expires_at: addDays(now, settings.retention_days).toISOString(),
        created_at: nowIso,
        updated_at: nowIso
      });
      for (const option of parsedOptions) {
        state.mastermind_options.push({
          id: randomUUID(),
          thread_id: threadId,
          option_key: option.option_key,
          title: option.title,
          rationale: null,
          created_at: nowIso
        });
      }
      pruneGovernanceState(state);
    });
    if (settings!.slack_enabled && settings!.slack_addon_active) {
      await dispatchSlackGovernanceNotification(
        settings!,
        `*PG Mastermind thread created from Slack*\nBy: ${user.email}\nThread: ${title}\nThread ID: ${threadId}`
      );
    }
    return {
      response_type: "ephemeral",
      text: `Thread created. ID: ${threadId}`,
      blocks: buildSlackThreadInteractionBlocks(store.snapshot(), threadId, user.id)
    };
  }

  if (action === "vote") {
    const [threadId, optionKey, ...rationaleParts] = rest.split(/\s+/).filter(Boolean);
    if (!threadId || !optionKey) {
      return {
        response_type: "ephemeral",
        text: "Usage: `vote <thread_id> <option_key> [rationale]`"
      };
    }
    if (!isUuidLike(threadId)) {
      return {
        response_type: "ephemeral",
        text:
          "Invalid `thread_id`. Use the real ID from `Thread created. ID: ...` then run `vote <thread_id> opt1`."
      };
    }
    const rationale = rationaleParts.join(" ").trim() || null;
    await store.update((state) => {
      const thread = state.mastermind_threads.find((item) => item.id === threadId);
      if (!thread) {
        throw new Error("thread not found");
      }
      if (!canAccessGovernanceThread(state, thread, user.id)) {
        throw new Error("not authorized for this thread");
      }
      if (thread.status !== "open") {
        throw new Error("thread is not open");
      }
      const option = state.mastermind_options.find(
        (item) => item.thread_id === threadId && item.option_key === optionKey.toLowerCase()
      );
      if (!option) {
        throw new Error("option_key was not found in this thread");
      }
      const now = new Date();
      const nowIso = now.toISOString();
      const existing = state.mastermind_votes.find(
        (item) => item.thread_id === threadId && item.user_id === user.id
      );
      if (existing) {
        existing.option_key = option.option_key;
        existing.rationale = rationale;
        existing.updated_at = nowIso;
      } else {
        state.mastermind_votes.push({
          id: randomUUID(),
          thread_id: threadId,
          option_key: option.option_key,
          user_id: user.id,
          email: user.email,
          weight: 1,
          rationale,
          created_at: nowIso,
          updated_at: nowIso
        });
      }
      thread.last_activity_at = nowIso;
      thread.updated_at = nowIso;
      pruneGovernanceState(state);
    });
    return {
      response_type: "ephemeral",
      text: `Vote saved for thread ${threadId} -> ${optionKey.toLowerCase()}`
    };
  }

  if (action === "decide") {
    const tokens = rest.split(/\s+/).filter(Boolean);
    const threadId = tokens[0];
    const decisionInput = tokens[1];
    if (!threadId || !decisionInput) {
      return {
        response_type: "ephemeral",
        text: "Usage: `decide <thread_id> <approve|reject|needs_change> [option_key] [note]`"
      };
    }
    if (!isUuidLike(threadId)) {
      return {
        response_type: "ephemeral",
        text:
          "Invalid `thread_id`. Use the real ID from `Thread created. ID: ...` then run `decide <thread_id> approve`."
      };
    }
    const decision = normalizeMastermindDecision(decisionInput);
    if (!decision) {
      return {
        response_type: "ephemeral",
        text: "Invalid decision. Use one of: `approve`, `reject`, `needs_change`."
      };
    }

    let requestedOptionKey: string | null = null;
    let noteStartIndex = 2;
    const maybeOption = tokens[2]?.trim().toLowerCase() ?? "";
    if (/^(opt[0-9]+|option-[0-9]+)$/.test(maybeOption)) {
      requestedOptionKey = maybeOption;
      noteStartIndex = 3;
    }
    const note = tokens.slice(noteStartIndex).join(" ").trim() || null;
    if (note && note.length > 12000) {
      return {
        response_type: "ephemeral",
        text: "note is too long"
      };
    }

    let outcomeResult: StoreState["mastermind_outcomes"][number] | null = null;
    await store.update((state) => {
      const thread = state.mastermind_threads.find((item) => item.id === threadId);
      if (!thread) {
        throw new Error("thread not found");
      }
      if (!canFinalizeGovernanceThread(state, thread, user.id)) {
        throw new Error("only owner/manager (or thread creator for personal scope) can finalize");
      }
      if (thread.status !== "open") {
        throw new Error("thread is already finalized");
      }
      const settings = resolveGovernanceSettingsForThread(state, thread, user.id);
      if (note && note.length > settings.max_debate_chars) {
        throw new Error(`note exceeds max_debate_chars (${settings.max_debate_chars})`);
      }
      const now = new Date();
      const nowIso = now.toISOString();
      const winningOptionKey = requestedOptionKey ?? chooseWinningOptionFromVotes(state, thread.id) ?? null;
      if (winningOptionKey) {
        const option = state.mastermind_options.find(
          (item) => item.thread_id === thread.id && item.option_key === winningOptionKey
        );
        if (!option) {
          throw new Error("option_key was not found in this thread");
        }
      }

      thread.status = "decided";
      thread.decision = decision;
      thread.decision_option_key = winningOptionKey;
      thread.decision_note = note;
      thread.decided_by_user_id = user.id;
      thread.decided_by_email = user.email;
      thread.decided_at = nowIso;
      thread.last_activity_at = nowIso;
      thread.updated_at = nowIso;
      thread.expires_at = addDays(now, settings.retention_days).toISOString();

      const outcome: StoreState["mastermind_outcomes"][number] = {
        id: randomUUID(),
        thread_id: thread.id,
        team_id: thread.team_id,
        title: thread.title,
        decision,
        winning_option_key: winningOptionKey,
        decision_note: note,
        decided_by_email: user.email,
        decided_at: nowIso,
        created_at: nowIso
      };
      state.mastermind_outcomes.push(outcome);
      outcomeResult = outcome;

      createGovernanceDecisionEvent(state, thread, outcome, settings.retention_days);
      pruneGovernanceState(state);
    });

    const snapshotAfter = store.snapshot();
    const finalOutcome =
      snapshotAfter.mastermind_outcomes
        .filter((item) => item.thread_id === threadId)
        .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0] ?? outcomeResult;
    if (finalOutcome) {
      const settings =
        finalOutcome.team_id !== null
          ? getGovernanceSettingsForScope(snapshotAfter, "team", finalOutcome.team_id) ??
            buildDefaultGovernanceSettings("team", finalOutcome.team_id, new Date().toISOString())
          : getGovernanceSettingsForScope(snapshotAfter, "user", user.id) ??
            buildDefaultGovernanceSettings("user", user.id, new Date().toISOString());
      if (settings.slack_enabled && settings.slack_addon_active) {
        void dispatchSlackGovernanceNotification(
          settings,
          [
            "*PG Mastermind decision finalized*",
            `Title: ${finalOutcome.title}`,
            `Decision: ${finalOutcome.decision}`,
            `Winning option: ${finalOutcome.winning_option_key ?? "none"}`,
            `By: ${user.email}`,
            `Thread ID: ${finalOutcome.thread_id}`
          ].join("\n")
        ).catch((error) => {
          app.log.warn(
            { error: toErrorMessage(error), thread_id: finalOutcome.thread_id },
            "Slack decision dispatch failed (slash decide)"
          );
        });
      }
    }

    return {
      response_type: "ephemeral",
      text: `Decision saved for thread ${threadId}: ${decision}.`,
      blocks: buildSlackThreadInteractionBlocks(store.snapshot(), threadId, user.id)
    };
  }

  return {
    response_type: "ephemeral",
    text: `Unknown command: ${action}. Use \`help\`.`
  };
}

async function resolveSlackPayloadUser(payload: Record<string, unknown>): Promise<UserRecord | null> {
  const teamId = getString(getObject(payload, ["team"]), "id") ?? getString(payload, "team_id");
  if (SLACK_ALLOWED_TEAM_IDS.size > 0 && (!teamId || !SLACK_ALLOWED_TEAM_IDS.has(teamId))) {
    return null;
  }

  const userObject = getObject(payload, ["user"]);
  const slackUserId = getString(userObject, "id");
  if (!slackUserId) {
    return null;
  }
  const payloadEmail = normalizeEmail(getString(userObject, "email"));
  const userEmail = payloadEmail ?? (await resolveSlackUserEmail(slackUserId));
  if (!userEmail) {
    return null;
  }
  if (SLACK_ALLOWED_EMAILS.size > 0 && !SLACK_ALLOWED_EMAILS.has(userEmail)) {
    return null;
  }
  return getOrCreateUserByEmail(userEmail);
}

async function executeSlackGovernanceAction(
  user: UserRecord,
  actionId: string,
  action: Record<string, unknown>
): Promise<SlackEphemeralResponse> {
  const normalizedActionId = actionId.trim().toLowerCase();
  if (!normalizedActionId) {
    throw new Error("Slack action id is missing.");
  }

  if (normalizedActionId === "pg_help" || normalizedActionId === "pg_cmd_help") {
    return executeSlackGovernanceCommand(user, "help");
  }

  if (normalizedActionId === "pg_summary" || normalizedActionId === "pg_cmd_summary") {
    return executeSlackGovernanceCommand(user, "summary");
  }

  const actionPayload = parseSlackActionPayload(action);
  const threadId = getString(actionPayload, "thread_id")?.trim();

  if (normalizedActionId === "pg_thread_summary") {
    if (!threadId) {
      throw new Error("thread_id is required for thread summary action.");
    }
    return {
      response_type: "ephemeral",
      text: `Thread ${threadId}`,
      blocks: buildSlackThreadInteractionBlocks(store.snapshot(), threadId, user.id),
      replace_original: false
    };
  }

  if (normalizedActionId === "pg_vote_option" || normalizedActionId.startsWith("pg_vote_option_")) {
    const optionKey = getString(actionPayload, "option_key")?.trim().toLowerCase();
    const rationale = getString(actionPayload, "rationale")?.trim() || null;
    if (!threadId || !optionKey) {
      throw new Error("thread_id and option_key are required for vote action.");
    }
    await store.update((state) => {
      const thread = state.mastermind_threads.find((item) => item.id === threadId);
      if (!thread) {
        throw new Error("thread not found");
      }
      if (!canAccessGovernanceThread(state, thread, user.id)) {
        throw new Error("not authorized for this thread");
      }
      if (thread.status !== "open") {
        throw new Error("thread is not open");
      }
      const settings = resolveGovernanceSettingsForThread(state, thread, user.id);
      if (rationale && rationale.length > settings.max_debate_chars) {
        throw new Error(`rationale exceeds max_debate_chars (${settings.max_debate_chars})`);
      }
      const option = state.mastermind_options.find(
        (item) => item.thread_id === thread.id && item.option_key === optionKey
      );
      if (!option) {
        throw new Error("option_key was not found in this thread");
      }
      const now = new Date();
      const nowIso = now.toISOString();
      thread.last_activity_at = nowIso;
      thread.updated_at = nowIso;
      thread.expires_at = addDays(now, settings.retention_days).toISOString();
      const existingVote = state.mastermind_votes.find(
        (item) => item.thread_id === thread.id && item.user_id === user.id
      );
      if (existingVote) {
        existingVote.option_key = optionKey;
        existingVote.rationale = rationale;
        existingVote.updated_at = nowIso;
      } else {
        state.mastermind_votes.push({
          id: randomUUID(),
          thread_id: thread.id,
          option_key: optionKey,
          user_id: user.id,
          email: user.email,
          weight: 1,
          rationale,
          created_at: nowIso,
          updated_at: nowIso
        });
      }
      pruneGovernanceState(state);
    });
    return {
      response_type: "ephemeral",
      text: `Vote saved for thread ${threadId} -> ${optionKey}`,
      blocks: buildSlackThreadInteractionBlocks(store.snapshot(), threadId, user.id),
      replace_original: false
    };
  }

  if (
    normalizedActionId === "pg_decide_thread" ||
    normalizedActionId.startsWith("pg_decide_thread_")
  ) {
    const decision = normalizeMastermindDecision(getString(actionPayload, "decision")) ?? "approve";
    const requestedOptionKey = getString(actionPayload, "option_key")?.trim().toLowerCase() || null;
    const note = getString(actionPayload, "note")?.trim() || null;
    if (!threadId) {
      throw new Error("thread_id is required for decision action.");
    }
    if (note && note.length > 12000) {
      throw new Error("note is too long");
    }

    let outcomeResult: StoreState["mastermind_outcomes"][number] | null = null;
    await store.update((state) => {
      const thread = state.mastermind_threads.find((item) => item.id === threadId);
      if (!thread) {
        throw new Error("thread not found");
      }
      if (!canFinalizeGovernanceThread(state, thread, user.id)) {
        throw new Error("only owner/manager (or thread creator for personal scope) can finalize");
      }
      if (thread.status !== "open") {
        throw new Error("thread is already finalized");
      }
      const settings = resolveGovernanceSettingsForThread(state, thread, user.id);
      if (note && note.length > settings.max_debate_chars) {
        throw new Error(`note exceeds max_debate_chars (${settings.max_debate_chars})`);
      }
      const now = new Date();
      const nowIso = now.toISOString();
      const winningOptionKey =
        requestedOptionKey ?? chooseWinningOptionFromVotes(state, thread.id) ?? null;
      if (winningOptionKey) {
        const option = state.mastermind_options.find(
          (item) => item.thread_id === thread.id && item.option_key === winningOptionKey
        );
        if (!option) {
          throw new Error("option_key was not found in this thread");
        }
      }

      thread.status = "decided";
      thread.decision = decision;
      thread.decision_option_key = winningOptionKey;
      thread.decision_note = note;
      thread.decided_by_user_id = user.id;
      thread.decided_by_email = user.email;
      thread.decided_at = nowIso;
      thread.last_activity_at = nowIso;
      thread.updated_at = nowIso;
      thread.expires_at = addDays(now, settings.retention_days).toISOString();

      const outcome: StoreState["mastermind_outcomes"][number] = {
        id: randomUUID(),
        thread_id: thread.id,
        team_id: thread.team_id,
        title: thread.title,
        decision,
        winning_option_key: winningOptionKey,
        decision_note: note,
        decided_by_email: user.email,
        decided_at: nowIso,
        created_at: nowIso
      };
      state.mastermind_outcomes.push(outcome);
      outcomeResult = outcome;

      createGovernanceDecisionEvent(state, thread, outcome, settings.retention_days);
      pruneGovernanceState(state);
    });

    const snapshotAfter = store.snapshot();
    const finalOutcome =
      snapshotAfter.mastermind_outcomes
        .filter((item) => item.thread_id === threadId)
        .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0] ?? outcomeResult;
    if (finalOutcome) {
      const settings =
        finalOutcome.team_id !== null
          ? getGovernanceSettingsForScope(snapshotAfter, "team", finalOutcome.team_id) ??
            buildDefaultGovernanceSettings("team", finalOutcome.team_id, new Date().toISOString())
          : getGovernanceSettingsForScope(snapshotAfter, "user", user.id) ??
            buildDefaultGovernanceSettings("user", user.id, new Date().toISOString());
      if (settings.slack_enabled && settings.slack_addon_active) {
        await dispatchSlackGovernanceNotification(
          settings,
          [
            "*PG Mastermind decision finalized*",
            `Title: ${finalOutcome.title}`,
            `Decision: ${finalOutcome.decision}`,
            `Winning option: ${finalOutcome.winning_option_key ?? "none"}`,
            `By: ${user.email}`,
            `Thread ID: ${finalOutcome.thread_id}`
          ].join("\n")
        );
      }
    }

    return {
      response_type: "ephemeral",
      text: `Decision saved for thread ${threadId}.`,
      blocks: buildSlackThreadInteractionBlocks(store.snapshot(), threadId, user.id),
      replace_original: false
    };
  }

  throw new Error(`Unsupported Slack action: ${normalizedActionId}`);
}

function parseSlackActionPayload(action: Record<string, unknown>): Record<string, unknown> {
  const value =
    getString(action, "value") ?? getString(getObject(action, ["selected_option"]), "value");
  if (!value) {
    return {};
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function buildSlackThreadInteractionBlocks(
  state: StoreState,
  threadId: string,
  viewerUserId?: string
): Array<Record<string, unknown>> {
  const thread = state.mastermind_threads.find((item) => item.id === threadId);
  if (!thread) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Thread \`${threadId}\` was not found.`
        }
      }
    ];
  }
  const options = state.mastermind_options
    .filter((item) => item.thread_id === thread.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const tally = buildMastermindVoteTally(state, thread.id);
  const outcome =
    state.mastermind_outcomes
      .filter((item) => item.thread_id === thread.id)
      .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0] ?? null;
  const tallyText =
    tally.length > 0
      ? tally.map((item) => `- *${item.option_key}* (${item.title}): ${item.votes} vote(s)`).join("\n")
      : "- no votes yet";
  const decisionText = outcome
    ? `\n*Decision:* ${outcome.decision} (${outcome.winning_option_key ?? "none"}) by ${
        outcome.decided_by_email ?? "unknown"
      }`
    : "";
  const viewerCanVote = viewerUserId ? canAccessGovernanceThread(state, thread, viewerUserId) : true;
  const viewerCanFinalize = viewerUserId
    ? canFinalizeGovernanceThread(state, thread, viewerUserId)
    : false;
  const viewerMembership =
    viewerUserId && thread.team_id
      ? state.team_memberships.find(
          (item) =>
            item.team_id === thread.team_id &&
            item.user_id === viewerUserId &&
            item.status === "active" &&
            item.revoked_at === null
        )
      : undefined;
  const team = thread.team_id ? state.teams.find((item) => item.id === thread.team_id) : undefined;
  const viewerTeamRole = viewerMembership?.role;
  const viewerRoleLabel = viewerUserId
    ? viewerTeamRole
      ? viewerCanFinalize
        ? `${viewerTeamRole} (can vote + finalize)`
        : viewerCanVote
          ? `${viewerTeamRole} (vote only)`
          : `${viewerTeamRole} (read-only)`
      : viewerCanFinalize
        ? "personal scope creator (can finalize)"
        : viewerCanVote
          ? "voter (vote only)"
          : "read-only"
    : "unspecified";

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          thread.team_id ? `*Scope:* team${team ? ` (${team.team_key})` : ""}` : "*Scope:* personal",
          `*Thread:* ${thread.title}`,
          `*Question:* ${thread.question.slice(0, 800)}`,
          `*Status:* ${thread.status}`,
          "*Vote Tally:*",
          tallyText,
          decisionText
        ]
          .filter(Boolean)
          .join("\n")
      }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: [
            "*Workflow:* 1) Team votes on options. 2) Owner/manager finalizes.",
            viewerUserId ? `*Your access:* ${viewerRoleLabel}` : ""
          ]
            .filter(Boolean)
            .join("\n")
        }
      ]
    }
  ];

  if (thread.status === "open") {
    if (viewerCanVote) {
      const optionButtonChunks = chunkSlackButtons(
        options.map((option) => ({
          type: "button",
          text: { type: "plain_text", text: `Vote ${option.option_key}` },
          action_id: `pg_vote_option_${normalizeSlackActionSuffix(option.option_key)}`,
          value: JSON.stringify({ thread_id: thread.id, option_key: option.option_key })
        }))
      );
      for (const chunk of optionButtonChunks) {
        blocks.push({
          type: "actions",
          elements: chunk
        });
      }
    } else {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Voting:* you can view this thread, but you cannot vote on it."
          }
        ]
      });
    }

    if (viewerCanFinalize) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            action_id: "pg_decide_thread_approve",
            value: JSON.stringify({ thread_id: thread.id, decision: "approve" })
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Needs Change" },
            action_id: "pg_decide_thread_needs_change",
            value: JSON.stringify({ thread_id: thread.id, decision: "needs_change" })
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Reject" },
            style: "danger",
            action_id: "pg_decide_thread_reject",
            value: JSON.stringify({ thread_id: thread.id, decision: "reject" })
          }
        ]
      });
    } else {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Final decision:* only owner/manager can finalize this thread."
          }
        ]
      });
    }
  } else {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "*Thread finalized:* voting and decision actions are closed."
        }
      ]
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Refresh Thread" },
        action_id: "pg_thread_summary",
        value: JSON.stringify({ thread_id: thread.id })
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Account Summary" },
        action_id: "pg_cmd_summary",
        value: JSON.stringify({})
      }
    ]
  });

  return blocks;
}

function chunkSlackButtons(
  buttons: Array<Record<string, unknown>>,
  chunkSize = 5
): Array<Array<Record<string, unknown>>> {
  const output: Array<Array<Record<string, unknown>>> = [];
  for (let index = 0; index < buttons.length; index += chunkSize) {
    output.push(buttons.slice(index, index + chunkSize));
  }
  return output;
}

function getStringLikeValue(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function normalizeSlackActionSuffix(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

async function requireCloudflareAccess(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  if (!CLOUDFLARE_ACCESS_TEAM_DOMAIN || !CLOUDFLARE_ACCESS_AUD) {
    reply.code(503).send({ error: "Cloudflare Access is not fully configured." });
    return false;
  }
  const assertionHeader = request.headers["cf-access-jwt-assertion"];
  const assertion = Array.isArray(assertionHeader) ? assertionHeader[0] : assertionHeader;
  if (!assertion) {
    reply.code(401).send({ error: "Cloudflare Access assertion header is required." });
    return false;
  }

  try {
    const certificate = await resolveCloudflareAccessCertificate(assertion);
    const issuer = `https://${CLOUDFLARE_ACCESS_TEAM_DOMAIN}`;
    jwt.verify(assertion, certificate, {
      algorithms: ["RS256"],
      audience: CLOUDFLARE_ACCESS_AUD,
      issuer: [issuer, `${issuer}/`]
    });
    return true;
  } catch (error) {
    reply.code(401).send({ error: `Cloudflare Access verification failed: ${toErrorMessage(error)}` });
    return false;
  }
}

async function resolveCloudflareAccessCertificate(token: string): Promise<string> {
  const decoded = jwt.decode(token, { complete: true }) as
    | { header?: Record<string, unknown> }
    | null;
  const kid = decoded?.header?.kid;
  if (typeof kid !== "string" || !kid) {
    throw new Error("invalid JWT header: missing kid");
  }
  const certByKid = await getCloudflareAccessCertMap();
  const cert = certByKid.get(kid);
  if (!cert) {
    throw new Error(`Cloudflare cert not found for kid ${kid}`);
  }
  return cert;
}

async function getCloudflareAccessCertMap(): Promise<Map<string, string>> {
  const nowMs = Date.now();
  if (
    cloudflareCertCache &&
    nowMs - cloudflareCertCache.fetchedAtMs < CLOUDFLARE_ACCESS_JWKS_TTL_SECONDS * 1000
  ) {
    return cloudflareCertCache.certByKid;
  }
  const url = `https://${CLOUDFLARE_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`failed to fetch certs (${response.status})`);
  }
  const payload = (await response.json()) as Record<string, unknown>;
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  const certByKid = new Map<string, string>();
  for (const key of keys) {
    if (!key || typeof key !== "object") {
      continue;
    }
    const keyRecord = key as Record<string, unknown>;
    const kid = typeof keyRecord.kid === "string" ? keyRecord.kid : "";
    const x5c = Array.isArray(keyRecord.x5c) && typeof keyRecord.x5c[0] === "string"
      ? keyRecord.x5c[0]
      : null;
    if (!kid || !x5c) {
      continue;
    }
    const wrapped = x5c.match(/.{1,64}/g)?.join("\n") ?? x5c;
    const cert = `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
    certByKid.set(kid, cert);
  }
  if (certByKid.size === 0) {
    throw new Error("no valid certs in Cloudflare Access JWKS");
  }
  cloudflareCertCache = {
    fetchedAtMs: nowMs,
    certByKid
  };
  return certByKid;
}

function getObject(source: Record<string, unknown>, pathSegments: string[]): Record<string, unknown> {
  let current: unknown = source;
  for (const segment of pathSegments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return {};
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current && typeof current === "object" ? (current as Record<string, unknown>) : {};
}

function getString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

function getNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === "number" ? value : undefined;
}

function asPaidPlanTier(value: string | undefined): PaidPlanTier | undefined {
  if (value === "pro" || value === "team" || value === "enterprise") {
    return value;
  }
  return undefined;
}

function asModuleScope(value: string | undefined): ModuleScope | undefined {
  if (value === "narrate" || value === "memorybank" || value === "bundle") {
    return value;
  }
  return undefined;
}

function isLoopbackCallbackUrl(callbackUrl: string): boolean {
  try {
    const parsed = new URL(callbackUrl);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

function isAllowedOAuthCallbackUrl(callbackUrl: string): boolean {
  if (isLoopbackCallbackUrl(callbackUrl)) {
    return true;
  }
  try {
    const parsed = new URL(callbackUrl);
    const protocolAllowed = parsed.protocol === "https:" || parsed.protocol === "http:";
    if (!protocolAllowed) {
      return false;
    }
    return OAUTH_CALLBACK_ORIGINS.includes(parsed.origin);
  } catch {
    return false;
  }
}

async function consumeOAuthState(provider: "github" | "google", stateToken: string) {
  const snapshot = store.snapshot();
  const record = snapshot.oauth_states.find(
    (item) =>
      item.provider === provider &&
      item.state === stateToken &&
      item.consumed_at === null &&
      new Date(item.expires_at).getTime() > Date.now()
  );
  if (!record) {
    return undefined;
  }
  await store.update((state) => {
    const mutable = state.oauth_states.find((item) => item.id === record.id);
    if (!mutable || mutable.consumed_at !== null) {
      throw new Error("oauth state already consumed");
    }
    mutable.consumed_at = new Date().toISOString();
  });
  return record;
}

async function exchangeGitHubOAuthCode(code: string, stateValue: string): Promise<string> {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new Error("GitHub OAuth is not configured.");
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_REDIRECT_URI,
      state: stateValue
    })
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    const err = typeof payload.error_description === "string" ? payload.error_description : "unknown";
    throw new Error(`GitHub token exchange failed: ${err}`);
  }
  return payload.access_token;
}

async function exchangeGoogleOAuthCode(code: string): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth is not configured.");
  }
  const form = new URLSearchParams();
  form.set("client_id", GOOGLE_CLIENT_ID);
  form.set("client_secret", GOOGLE_CLIENT_SECRET);
  form.set("code", code);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", GOOGLE_REDIRECT_URI);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    const err = typeof payload.error_description === "string" ? payload.error_description : "unknown";
    throw new Error(`Google token exchange failed: ${err}`);
  }
  return payload.access_token;
}

async function fetchGitHubProfile(accessToken: string): Promise<{ id: number; email?: string }> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "narrate-licensing-server"
    }
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof payload.id !== "number") {
    throw new Error("GitHub profile fetch failed.");
  }
  return {
    id: payload.id,
    email: typeof payload.email === "string" ? payload.email : undefined
  };
}

async function fetchGoogleProfile(accessToken: string): Promise<{
  email?: string;
  email_verified?: boolean;
}> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error("Google profile fetch failed.");
  }
  return {
    email: typeof payload.email === "string" ? payload.email : undefined,
    email_verified: payload.email_verified === true
  };
}

async function resolveGitHubPrimaryEmail(
  accessToken: string,
  profileEmail?: string
): Promise<string | undefined> {
  const normalizedProfile = normalizeEmail(profileEmail);
  if (normalizedProfile) {
    return normalizedProfile;
  }

  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "narrate-licensing-server"
    }
  });
  const payload = (await response.json()) as Array<Record<string, unknown>>;
  if (!response.ok || !Array.isArray(payload)) {
    return undefined;
  }
  const primary = payload.find(
    (item) => item.primary === true && item.verified === true && typeof item.email === "string"
  );
  if (primary && typeof primary.email === "string") {
    return normalizeEmail(primary.email);
  }
  const fallback = payload.find(
    (item) => item.verified === true && typeof item.email === "string"
  );
  if (fallback && typeof fallback.email === "string") {
    return normalizeEmail(fallback.email);
  }
  return undefined;
}

function findUserByEmail(email: string): UserRecord | undefined {
  const user = store.snapshot().users.find((item) => item.email === email);
  if (!user) {
    return undefined;
  }
  return { ...user };
}

async function getOrCreateUserByEmailInternal(
  email: string,
  options: { touchLastLogin: boolean; createIfMissing: boolean }
): Promise<UserRecord> {
  const existing = findUserByEmail(email);
  if (existing && !options.touchLastLogin) {
    return existing;
  }
  if (!existing && !options.createIfMissing) {
    throw new Error(`User not found for email: ${email}`);
  }

  let userRecord: UserRecord | undefined;
  await store.update((state) => {
    const nowIso = new Date().toISOString();
    let user = state.users.find((item) => item.email === email);
    if (!user) {
      user = {
        id: randomUUID(),
        email,
        created_at: nowIso,
        last_login_at: nowIso
      };
      state.users.push(user);
    } else {
      if (options.touchLastLogin) {
        user.last_login_at = nowIso;
      }
    }
    userRecord = { ...user };
  });
  if (!userRecord) {
    throw new Error("Unable to create user.");
  }
  return userRecord;
}

async function getOrCreateUserByEmail(
  email: string,
  options: { touchLastLogin?: boolean; createIfMissing?: boolean } = {}
): Promise<UserRecord> {
  return getOrCreateUserByEmailInternal(email, {
    touchLastLogin: options.touchLastLogin ?? true,
    createIfMissing: options.createIfMissing ?? true
  });
}

function replyAfterOAuth(
  callbackUrl: string | null,
  reply: FastifyReply,
  payload: {
    status: "ok" | "error";
    message?: string;
    access_token?: string;
    expires_in_sec?: number;
    user_id?: string;
  }
) {
  if (callbackUrl && isAllowedOAuthCallbackUrl(callbackUrl)) {
    const target = new URL(callbackUrl);
    const includeTokenInUrl = !isPortalCallbackUrl(target);
    target.searchParams.set("status", payload.status);
    if (payload.message) {
      target.searchParams.set("message", payload.message);
    }
    if (payload.access_token && includeTokenInUrl) {
      target.searchParams.set("access_token", payload.access_token);
    }
    if (payload.expires_in_sec) {
      target.searchParams.set("expires_in_sec", String(payload.expires_in_sec));
    }
    if (payload.user_id) {
      target.searchParams.set("user_id", payload.user_id);
    }
    return reply.redirect(target.toString());
  }
  return reply.send(payload);
}

function isPortalCallbackUrl(target: URL): boolean {
  return target.pathname === "/app";
}

async function issueEntitlement(
  request: FastifyRequest<{ Body: { install_id?: string; device_label?: string } }>,
  reply: FastifyReply,
  source: "activate" | "refresh"
): Promise<void | object> {
  const auth = requireAuth(request, reply);
  if (!auth) {
    return;
  }
  const installId = request.body?.install_id?.trim();
  if (!installId) {
    return reply.code(400).send({ error: "install_id is required" });
  }
  const deviceLabel = request.body?.device_label?.trim() || `${source}:${process.platform}`;

  const snapshotBefore = store.snapshot();
  const claimsBefore = buildEntitlementClaims(snapshotBefore, auth.user.id, installId);
  const deviceLimit = PLAN_RULES[claimsBefore.plan].device_limit;

  try {
    await store.update((state) => {
      ensureDeviceRecord(state, auth.user.id, installId, deviceLabel, deviceLimit);
      ensureQuotaRecord(state, auth.user.id, claimsBefore.plan);
    });
  } catch (error) {
    return reply.code(403).send({ error: toErrorMessage(error) });
  }

  const snapshotAfter = store.snapshot();
  const claims = buildEntitlementClaims(snapshotAfter, auth.user.id, installId);
  const token = signEntitlementToken(snapshotAfter, claims);
  return {
    entitlement_token: token,
    expires_at: new Date(claims.exp * 1000).toISOString()
  };
}

function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  options?: { silent?: boolean }
): { session: SessionRecord; user: UserRecord } | undefined {
  const silent = options?.silent === true;
  const token = getBearerToken(request.headers.authorization) || getSessionTokenFromCookie(request);
  if (!token) {
    if (!silent) {
      reply.code(401).send({ error: "missing auth token" });
    }
    return undefined;
  }

  const snapshot = store.snapshot();
  const session = snapshot.sessions.find((item) => item.token === token);
  if (!session) {
    if (!silent) {
      reply.code(401).send({ error: "invalid bearer token" });
    }
    return undefined;
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    if (!silent) {
      reply.code(401).send({ error: "session expired" });
    }
    return undefined;
  }

  const user = snapshot.users.find((item) => item.id === session.user_id);
  if (!user) {
    if (!silent) {
      reply.code(401).send({ error: "session user not found" });
    }
    return undefined;
  }
  return { session, user };
}

async function requireAdminPermission(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: AdminPermissionKey
): Promise<AdminAccessContext | undefined> {
  if (CLOUDFLARE_ACCESS_ENABLED) {
    const cfAccess = await requireCloudflareAccess(request, reply);
    if (!cfAccess) {
      return undefined;
    }
  }
  const keyAuthorized = isAdminAuthorized(request);
  if (ADMIN_AUTH_MODE === "key") {
    if (!keyAuthorized) {
      reply.code(401).send({ error: "admin key required" });
      return undefined;
    }
    return {
      mode: "key",
      isSuperAdmin: true,
      permissions: new Set(Object.values(ADMIN_PERMISSION_KEYS))
    };
  }

  const auth = requireAuth(request, reply, { silent: ADMIN_AUTH_MODE === "hybrid" });
  if (!auth) {
    if (ADMIN_AUTH_MODE === "hybrid" && keyAuthorized) {
      return {
        mode: "key",
        isSuperAdmin: true,
        permissions: new Set(Object.values(ADMIN_PERMISSION_KEYS))
      };
    }
    if (ADMIN_AUTH_MODE === "hybrid") {
      reply.code(401).send({ error: "admin authentication required" });
    }
    return undefined;
  }

  let access: Awaited<ReturnType<typeof resolveAdminAccessFromDb>> | null = null;
  try {
    access = await resolveAdminAccessFromDb(auth.user.email);
  } catch (error) {
    app.log.warn({ error: toErrorMessage(error) }, "Failed to resolve admin RBAC access from DB");
    if (ADMIN_AUTH_MODE === "db") {
      reply.code(503).send({ error: "admin RBAC backend is unavailable" });
      return undefined;
    }
  }

  if (access && (access.isSuperAdmin || access.permissions.has(permission))) {
    return {
      mode: "db",
      isSuperAdmin: access.isSuperAdmin,
      permissions: access.permissions,
      userEmail: auth.user.email
    };
  }

  if (ADMIN_AUTH_MODE === "hybrid" && keyAuthorized) {
    return {
      mode: "key",
      isSuperAdmin: true,
      permissions: new Set(Object.values(ADMIN_PERMISSION_KEYS)),
      userEmail: auth.user.email
    };
  }

  if (access) {
    reply.code(403).send({ error: `missing admin permission: ${permission}` });
    return undefined;
  }

  reply.code(403).send({ error: "admin account is not authorized" });
  return undefined;
}

async function resolveAdminAccessFromDb(
  email: string
): Promise<{ isSuperAdmin: boolean; permissions: Set<string> } | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const account = await prisma.adminAccount.findFirst({
    where: { email: normalizedEmail, status: "active" },
    select: { id: true, isSuperAdmin: true }
  });
  if (!account) {
    return null;
  }

  const roleRows = await prisma.adminAccountRole.findMany({
    where: {
      adminAccountId: account.id,
      revokedAt: null
    },
    select: { roleId: true }
  });
  const roleIds = [...new Set(roleRows.map((row) => row.roleId))];
  const permissions = new Set<string>();

  if (roleIds.length > 0) {
    const rolePermissionRows = await prisma.adminRolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: { permissionId: true }
    });
    const permissionIds = [...new Set(rolePermissionRows.map((row) => row.permissionId))];
    if (permissionIds.length > 0) {
      const permissionRows = await prisma.adminPermission.findMany({
        where: { id: { in: permissionIds } },
        select: { permissionKey: true }
      });
      for (const row of permissionRows) {
        permissions.add(row.permissionKey);
      }
    }
  }

  return { isSuperAdmin: account.isSuperAdmin, permissions };
}

async function ensureAdminRbacBaseline(): Promise<void> {
  const now = new Date();
  const permissionDefinitions: Array<{ key: AdminPermissionKey; description: string }> = [
    { key: ADMIN_PERMISSION_KEYS.BOARD_READ, description: "Read global admin board dashboards." },
    {
      key: ADMIN_PERMISSION_KEYS.BOARD_SUPPORT_WRITE,
      description: "Update support ticket states from admin board."
    },
    {
      key: ADMIN_PERMISSION_KEYS.BOARD_SUBSCRIPTION_WRITE,
      description: "Revoke subscriptions from admin board."
    },
    {
      key: ADMIN_PERMISSION_KEYS.BOARD_SESSION_REVOKE,
      description: "Revoke user sessions from admin board."
    },
    { key: ADMIN_PERMISSION_KEYS.REFUND_APPROVE, description: "Approve refund requests." },
    {
      key: ADMIN_PERMISSION_KEYS.SUBSCRIPTION_GRANT,
      description: "Grant manual subscriptions."
    },
    { key: ADMIN_PERMISSION_KEYS.TEAM_MANAGE, description: "Create and manage enterprise teams." },
    {
      key: ADMIN_PERMISSION_KEYS.PROVIDER_POLICY_MANAGE,
      description: "Set team or user provider policy constraints."
    },
    {
      key: ADMIN_PERMISSION_KEYS.OFFLINE_PAYMENT_REVIEW,
      description: "Approve or reject offline payment references."
    },
    {
      key: ADMIN_PERMISSION_KEYS.AFFILIATE_MANAGE,
      description: "Confirm affiliate conversions and approve payouts."
    }
  ];
  const permissionIdByKey = new Map<string, string>();
  for (const permission of permissionDefinitions) {
    const row = await prisma.adminPermission.upsert({
      where: { permissionKey: permission.key },
      update: { description: permission.description },
      create: {
        id: randomUUID(),
        permissionKey: permission.key,
        description: permission.description,
        createdAt: now
      }
    });
    permissionIdByKey.set(permission.key, row.id);
  }

  const roleDefinitions: Array<{
    roleKey: string;
    displayName: string;
    description: string;
    permissions: AdminPermissionKey[];
  }> = [
    {
      roleKey: "pg_global_super_admin",
      displayName: "PG Global Super Admin",
      description: "Full access to all PG global operational controls.",
      permissions: Object.values(ADMIN_PERMISSION_KEYS)
    },
    {
      roleKey: "pg_support_admin",
      displayName: "PG Support Admin",
      description: "Support operations and payment review controls.",
      permissions: [
        ADMIN_PERMISSION_KEYS.BOARD_READ,
        ADMIN_PERMISSION_KEYS.BOARD_SUPPORT_WRITE,
        ADMIN_PERMISSION_KEYS.OFFLINE_PAYMENT_REVIEW,
        ADMIN_PERMISSION_KEYS.REFUND_APPROVE
      ]
    }
  ];

  const roleIdByKey = new Map<string, string>();
  for (const roleDefinition of roleDefinitions) {
    const role = await prisma.adminRole.upsert({
      where: { roleKey: roleDefinition.roleKey },
      update: {
        displayName: roleDefinition.displayName,
        description: roleDefinition.description,
        updatedAt: now
      },
      create: {
        id: randomUUID(),
        roleKey: roleDefinition.roleKey,
        displayName: roleDefinition.displayName,
        description: roleDefinition.description,
        isSystemRole: true,
        createdAt: now,
        updatedAt: now
      }
    });
    roleIdByKey.set(roleDefinition.roleKey, role.id);

    for (const permissionKey of roleDefinition.permissions) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) {
        continue;
      }
      const existing = await prisma.adminRolePermission.findFirst({
        where: {
          roleId: role.id,
          permissionId
        },
        select: { id: true }
      });
      if (!existing) {
        await prisma.adminRolePermission.create({
          data: {
            id: randomUUID(),
            roleId: role.id,
            permissionId,
            createdAt: now
          }
        });
      }
    }
  }

  const superAdminRoleId = roleIdByKey.get("pg_global_super_admin");
  if (!superAdminRoleId || ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS.size === 0) {
    return;
  }
  for (const email of ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS) {
    const account = await prisma.adminAccount.upsert({
      where: { email },
      update: {
        status: "active",
        isSuperAdmin: true,
        updatedAt: now
      },
      create: {
        id: randomUUID(),
        email,
        fullName: defaultAdminNameFromEmail(email),
        status: "active",
        isSuperAdmin: true,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null
      }
    });

    const existingAssignment = await prisma.adminAccountRole.findFirst({
      where: {
        adminAccountId: account.id,
        roleId: superAdminRoleId
      },
      select: { id: true, revokedAt: true }
    });
    if (!existingAssignment) {
      await prisma.adminAccountRole.create({
        data: {
          id: randomUUID(),
          adminAccountId: account.id,
          roleId: superAdminRoleId,
          scopeId: null,
          assignedByAdminId: null,
          createdAt: now,
          revokedAt: null
        }
      });
    } else if (existingAssignment.revokedAt !== null) {
      await prisma.adminAccountRole.update({
        where: { id: existingAssignment.id },
        data: { revokedAt: null }
      });
    }
  }
}

async function getSuperAdminEmailSet(): Promise<Set<string>> {
  const superAdminEmails = new Set<string>();
  if (SUPER_ADMIN_SOURCE !== "db") {
    for (const email of SUPER_ADMIN_EMAILS) {
      superAdminEmails.add(email);
    }
  }

  if (SUPER_ADMIN_SOURCE !== "env") {
    try {
      const rows = await prisma.adminAccount.findMany({
        where: { status: "active", isSuperAdmin: true },
        select: { email: true }
      });
      for (const row of rows) {
        const normalized = normalizeEmail(row.email);
        if (normalized) {
          superAdminEmails.add(normalized);
        }
      }
    } catch (error) {
      app.log.warn(
        { error: toErrorMessage(error), source: SUPER_ADMIN_SOURCE },
        "Failed to load super-admin emails from DB"
      );
      if (SUPER_ADMIN_SOURCE === "db") {
        return new Set<string>();
      }
    }
  }
  return superAdminEmails;
}

function buildEntitlementClaims(
  state: StoreState,
  userId: string,
  installId: string
): EntitlementClaimPayload {
  const now = new Date();
  const planState = resolveEffectivePlan(state, userId, now);
  const plan = planState.plan;
  const modules = resolveModules(state, userId, plan, now);
  const features = {
    edu_view: plan !== "free",
    export: PLAN_RULES[plan].can_export,
    change_report: PLAN_RULES[plan].can_change_report,
    memorybank: modules.includes("memorybank") || modules.includes("bundle")
  };

  const quota = ensureQuotaRecord(state, userId, plan);
  const tokenTtlHours = resolveTokenTtlHours(plan, planState.subscription, now);
  const exp = Math.floor(addHours(now, tokenTtlHours).getTime() / 1000);

  return {
    sub: userId,
    install_id: installId,
    plan,
    features,
    modules,
    projects_allowed: quota.projects_allowed,
    projects_used: quota.projects_used,
    trial_expires_at: planState.trial?.trial_expires_at ?? null,
    refund_window_ends_at: planState.subscription?.refund_window_ends_at ?? null,
    token_max_ttl_hours: tokenTtlHours,
    provider_policy: resolveProviderPolicy(state, userId, planState.subscription?.team_id ?? null),
    iat: Math.floor(now.getTime() / 1000),
    exp
  };
}

function resolveEffectivePlan(
  state: StoreState,
  userId: string,
  now: Date
): { plan: PlanTier; subscription?: SubscriptionRecord; trial?: StoreState["trials"][number] } {
  const activeSubscription = state.subscriptions
    .filter((item) => item.user_id === userId && item.status === "active")
    .find((item) => {
      if (new Date(item.ends_at).getTime() <= now.getTime()) {
        return false;
      }
      if (!item.team_id) {
        return true;
      }
      return hasActiveTeamSeat(state, item.team_id, userId);
    });
  if (activeSubscription) {
    return { plan: activeSubscription.plan_id, subscription: activeSubscription };
  }

  const activeTrial = state.trials.find(
    (item) => item.user_id === userId && new Date(item.trial_expires_at).getTime() > now.getTime()
  );
  if (activeTrial) {
    return { plan: "trial", trial: activeTrial };
  }
  return { plan: "free" };
}

function resolveModules(
  state: StoreState,
  userId: string,
  plan: PlanTier,
  now: Date
): Array<"narrate" | "memorybank" | "bundle"> {
  if (plan === "free" || plan === "trial") {
    return ["narrate"];
  }

  const activeEntitlement = state.product_entitlements.find(
    (item) =>
      item.user_id === userId &&
      item.status === "active" &&
      new Date(item.ends_at).getTime() > now.getTime()
  );
  if (!activeEntitlement) {
    return ["narrate"];
  }

  const modules: Array<"narrate" | "memorybank" | "bundle"> = [];
  if (activeEntitlement.narrate_enabled) {
    modules.push("narrate");
  }
  if (activeEntitlement.memorybank_enabled) {
    modules.push("memorybank");
  }
  if (activeEntitlement.bundle_enabled) {
    modules.push("bundle");
  }
  return modules.length > 0 ? modules : ["narrate"];
}

function ensureDeviceRecord(
  state: StoreState,
  userId: string,
  installId: string,
  deviceLabel: string,
  deviceLimit: number
): void {
  const existing = state.devices.find(
    (item) => item.user_id === userId && item.install_id === installId
  );
  if (existing) {
    if (existing.revoked_at !== null) {
      throw new Error("device revoked");
    }
    existing.last_seen_at = new Date().toISOString();
    existing.device_label = deviceLabel;
    return;
  }

  const activeCount = state.devices.filter(
    (item) => item.user_id === userId && item.revoked_at === null
  ).length;
  if (activeCount >= deviceLimit) {
    throw new Error("device limit reached");
  }
  state.devices.push({
    id: randomUUID(),
    user_id: userId,
    install_id: installId,
    device_label: deviceLabel,
    last_seen_at: new Date().toISOString(),
    revoked_at: null
  });
}

function ensureQuotaRecord(
  state: StoreState,
  userId: string,
  plan: PlanTier
): ProjectQuotaRecord {
  const now = new Date();
  const allowed = PLAN_RULES[plan].projects_allowed_memorybank;
  let record = state.project_quotas.find(
    (item) => item.user_id === userId && item.scope === "memorybank"
  );
  if (!record) {
    record = {
      id: randomUUID(),
      user_id: userId,
      scope: "memorybank",
      period_start: now.toISOString(),
      period_end: addYears(now, 1).toISOString(),
      projects_allowed: allowed,
      projects_used: 0,
      updated_at: now.toISOString()
    };
    state.project_quotas.push(record);
    return record;
  }

  if (new Date(record.period_end).getTime() <= now.getTime()) {
    record.period_start = now.toISOString();
    record.period_end = addYears(now, 1).toISOString();
    record.projects_used = 0;
  }

  record.projects_allowed = allowed;
  record.updated_at = now.toISOString();
  return record;
}

function resolveTokenTtlHours(
  plan: PlanTier,
  subscription: SubscriptionRecord | undefined,
  now: Date
): number {
  if (plan === "free") {
    return 12;
  }
  if (plan === "trial") {
    return 24;
  }
  if (subscription && new Date(subscription.refund_window_ends_at).getTime() > now.getTime()) {
    return 24;
  }
  return 24 * 14;
}

function signEntitlementToken(
  state: StoreState,
  claims: EntitlementClaimPayload
): string {
  return jwt.sign(claims, state.keys.private_key_pem, {
    algorithm: state.keys.alg,
    keyid: "main"
  });
}

function getBearerToken(raw: string | undefined): string | undefined {
  if (!raw?.startsWith("Bearer ")) {
    return undefined;
  }
  return raw.substring("Bearer ".length).trim();
}

function getSessionTokenFromCookie(request: FastifyRequest): string | undefined {
  const cookieValue = request.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieValue !== "string") {
    return undefined;
  }
  const value = cookieValue.trim();
  return value || undefined;
}

function setSessionCookie(
  reply: FastifyReply,
  request: FastifyRequest,
  token: string
): void {
  const secure = SESSION_COOKIE_SECURE || isSecureRequest(request);
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure,
    maxAge: SESSION_TTL_HOURS * 60 * 60
  });
}

function clearSessionCookie(reply: FastifyReply, request: FastifyRequest): void {
  const secure = SESSION_COOKIE_SECURE || isSecureRequest(request);
  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure
  });
}

function isSecureRequest(request: FastifyRequest): boolean {
  const proto = request.headers["x-forwarded-proto"];
  if (typeof proto === "string") {
    return proto.split(",")[0].trim().toLowerCase() === "https";
  }
  if (Array.isArray(proto) && proto.length > 0) {
    return proto[0].trim().toLowerCase() === "https";
  }
  return request.protocol === "https";
}

function normalizeEmail(value: string | undefined): string | undefined {
  const lowered = value?.trim().toLowerCase();
  if (!lowered) {
    return undefined;
  }
  return lowered.includes("@") ? lowered : undefined;
}

function isAdminAuthorized(request: FastifyRequest): boolean {
  const key = request.headers["x-admin-key"];
  if (Array.isArray(key)) {
    return key.includes(ADMIN_KEY);
  }
  return key === ADMIN_KEY;
}

function normalizeAdminRoutePrefix(raw: string | undefined): string {
  const value = (raw ?? "/pg-global-admin").trim();
  if (!value) {
    return "/pg-global-admin";
  }
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.replace(/\/+$/, "") || "/pg-global-admin";
}

function parseStoreBackend(raw: string | undefined): StoreBackend {
  const value = (raw ?? "json").trim().toLowerCase();
  if (value === "json" || value === "prisma") {
    return value;
  }
  return "json";
}

function describeDatabaseTarget(raw: string | undefined): string {
  if (!raw || !raw.trim()) {
    return "not-configured";
  }
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname || "unknown-host";
    const port = parsed.port || "5432";
    const dbName = parsed.pathname.replace(/^\/+/, "") || "unknown-db";
    const schema = parsed.searchParams.get("schema");
    return schema ? `${host}:${port}/${dbName}?schema=${schema}` : `${host}:${port}/${dbName}`;
  } catch {
    return "invalid-database-url";
  }
}

function parseStringAllowList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  );
}

function parseEmailAllowList(raw: string | undefined): Set<string> {
  const emails = (raw ?? "")
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter((item): item is string => Boolean(item));
  return new Set(emails);
}

function parseSuperAdminSource(raw: string | undefined): "env" | "db" | "hybrid" {
  const value = (raw ?? "db").trim().toLowerCase();
  if (value === "env" || value === "db" || value === "hybrid") {
    return value;
  }
  return "db";
}

function parseAdminAuthMode(raw: string | undefined): AdminAuthMode {
  const value = (raw ?? "db").trim().toLowerCase();
  if (value === "key" || value === "db" || value === "hybrid") {
    return value;
  }
  return "db";
}

function defaultAdminNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  if (!local) {
    return "PG Global Admin";
  }
  const display = local
    .split(/[._-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return display || "PG Global Admin";
}

function parseCookieSameSite(
  raw: string | undefined,
  fallback: "strict" | "lax" | "none"
): "strict" | "lax" | "none" {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "strict" || value === "lax" || value === "none") {
    return value;
  }
  return fallback;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes" || value === "on") {
    return true;
  }
  if (value === "false" || value === "0" || value === "no" || value === "off") {
    return false;
  }
  return fallback;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addYears(date: Date, years: number): Date {
  const copy = new Date(date.getTime());
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
