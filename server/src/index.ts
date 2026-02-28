import "dotenv/config";
import * as path from "path";
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { AdminPermissionKeys } from "./adminRbacBootstrap";
import { registerAffiliateRoutes } from "./affiliateRoutes";
import { registerAccountRoutes } from "./accountRoutes";
import { registerAdminRoutes } from "./adminRoutes";
import { registerAuthRoutes } from "./authRoutes";
import {
  buildEntitlementClaims,
  resolveEffectivePlan
} from "./entitlementHelpers";
import { sanitizeLogText, sanitizeLogValue } from "./logSanitization";
import { registerGovernanceRoutes } from "./governanceRoutes";
import { createGovernanceHelpers } from "./governanceHelpers";
import { createOAuthHelpers } from "./oauthHelpers";
import { registerPaymentsRoutes } from "./paymentsRoutes";
import { registerTeamRoutes } from "./teamRoutes";
import { registerPolicyRoutes } from "./policyRoutes";
import { createSessionAuthHelpers } from "./sessionAuthHelpers";
import { createSlackIntegration } from "./slackIntegration";
import { registerSlackRoutes } from "./slackRoutes";
import { createSubscriptionHelpers } from "./subscriptionHelpers";
import { PrismaStateStore } from "./prismaStore";
import { configureServerRuntime } from "./serverRuntimeSetup";
import {
  addDays,
  clampInt,
  describeDatabaseTarget,
  getObject,
  getString,
  normalizeAdminRoutePrefix,
  normalizeEmail,
  asPaidPlanTier,
  asModuleScope,
  getNumber,
  parseBooleanEnv,
  parseCookieSameSite,
  parseAdminAuthMode,
  parseEmailAllowList,
  parseOriginList,
  parsePositiveInt,
  parseStoreBackend,
  parseStringAllowList,
  parseStripePriceMap,
  parseSuperAdminSource,
  safeJson,
  toErrorMessage,
  verifyStripeSignature
} from "./serverUtils";
import { JsonStore, StateStore } from "./store";
import {
  canManageTeamRole,
  hasActiveTeamSeat,
  resolveTeamAccessForUser
} from "./teamHelpers";
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
const ADMIN_PERMISSION_KEYS: AdminPermissionKeys = {
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
type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[keyof typeof ADMIN_PERMISSION_KEYS];
const app = Fastify({ logger: true, trustProxy: true });
const prisma = new PrismaClient();
const store: StateStore =
  STORE_BACKEND === "prisma" ? new PrismaStateStore(prisma) : new JsonStore(STORE_PATH);
function makeSafeLog(level: "info" | "warn" | "error") {
  return (message: string, context?: Record<string, unknown>): void => {
    const sm = sanitizeLogText(message, 600);
    if (context) {
      app.log[level](sanitizeLogValue(context) as Record<string, unknown>, sm);
      return;
    }
    app.log[level](sm);
  };
}
const safeLogInfo = makeSafeLog("info");
const safeLogWarn = makeSafeLog("warn");
const safeLogError = makeSafeLog("error");

const gov = createGovernanceHelpers({
  GOVERNANCE_ALLOW_PRO,
  GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS,
  GOVERNANCE_DEFAULT_RETENTION_DAYS,
  GOVERNANCE_MIN_RETENTION_DAYS,
  GOVERNANCE_MAX_RETENTION_DAYS,
  GOVERNANCE_MIN_DEBATE_CHARS,
  GOVERNANCE_MAX_DEBATE_CHARS,
  addDays,
  clampInt,
  resolveTeamAccessForUser,
  canManageTeamRole,
  resolveEffectivePlan,
  hasActiveTeamSeat
});
const {
  isAllowedOAuthCallbackUrl,
  consumeOAuthState,
  exchangeGitHubOAuthCode,
  exchangeGoogleOAuthCode,
  fetchGitHubProfile,
  fetchGoogleProfile,
  resolveGitHubPrimaryEmail,
  findUserByEmail,
  getOrCreateUserByEmail,
  replyAfterOAuth
} = createOAuthHelpers({
  store,
  githubClientId: GITHUB_CLIENT_ID,
  githubClientSecret: GITHUB_CLIENT_SECRET,
  githubRedirectUri: GITHUB_REDIRECT_URI,
  googleClientId: GOOGLE_CLIENT_ID,
  googleClientSecret: GOOGLE_CLIENT_SECRET,
  googleRedirectUri: GOOGLE_REDIRECT_URI,
  oauthCallbackOrigins: OAUTH_CALLBACK_ORIGINS
});
const {
  issueEntitlement,
  requireAuth,
  requireAdminPermission,
  resolveAdminAccessFromDb,
  ensureAdminRbacBaseline,
  getSuperAdminEmailSet,
  getSessionTokenFromCookie,
  setSessionCookie,
  clearSessionCookie
} = createSessionAuthHelpers({
  store,
  prisma,
  cloudflareAccessTeamDomain: CLOUDFLARE_ACCESS_TEAM_DOMAIN,
  cloudflareAccessAud: CLOUDFLARE_ACCESS_AUD,
  cloudflareAccessJwksTtlSeconds: CLOUDFLARE_ACCESS_JWKS_TTL_SECONDS,
  cloudflareAccessEnabled: CLOUDFLARE_ACCESS_ENABLED,
  adminKey: ADMIN_KEY,
  adminAuthMode: ADMIN_AUTH_MODE,
  adminPermissionKeys: ADMIN_PERMISSION_KEYS,
  sessionCookieName: SESSION_COOKIE_NAME,
  sessionCookieSecure: SESSION_COOKIE_SECURE,
  sessionCookieSameSite: SESSION_COOKIE_SAME_SITE,
  sessionTtlHours: SESSION_TTL_HOURS,
  superAdminEmails: SUPER_ADMIN_EMAILS,
  superAdminSource: SUPER_ADMIN_SOURCE as "env" | "db" | "both",
  adminBootstrapSuperAdminEmails: ADMIN_BOOTSTRAP_SUPER_ADMIN_EMAILS,
  safeLogWarn,
  isAllowedOAuthCallbackUrl
});
const {
  grantSubscriptionByEmail,
  grantSubscriptionByUserId,
  generateCode,
  clampCommissionRate,
  recordAffiliatePaidConversion,
  upsertProviderPolicy,
  resolveStripePriceId
} = createSubscriptionHelpers({
  store,
  refundWindowDays: REFUND_WINDOW_DAYS,
  defaultAffiliateRateBps: DEFAULT_AFFILIATE_RATE_BPS,
  stripePriceMap: STRIPE_PRICE_MAP
});
const slack = createSlackIntegration({
  SLACK_BOT_TOKEN,
  SLACK_WEBHOOK_URL,
  SLACK_ALLOWED_TEAM_IDS,
  SLACK_ALLOWED_EMAILS,
  SLACK_REQUEST_MAX_AGE_SECONDS,
  store,
  normalizeEmail,
  safeLogWarn,
  safeLogError,
  toErrorMessage,
  findUserByEmail,
  getOrCreateUserByEmail,
  buildEntitlementClaims,
  resolveGovernanceContextForUser: gov.resolveGovernanceContextForUser,
  getGovernanceSettingsForScope: gov.getGovernanceSettingsForScope,
  buildDefaultGovernanceSettings: gov.buildDefaultGovernanceSettings,
  upsertGovernanceSettings: gov.upsertGovernanceSettings,
  normalizeGovernanceVoteMode: gov.normalizeGovernanceVoteMode,
  normalizeMastermindDecision: gov.normalizeMastermindDecision,
  canAccessGovernanceThread: gov.canAccessGovernanceThread,
  canFinalizeGovernanceThread: gov.canFinalizeGovernanceThread,
  resolveGovernanceSettingsForThread: gov.resolveGovernanceSettingsForThread,
  buildMastermindVoteTally: gov.buildMastermindVoteTally,
  chooseWinningOptionFromVotes: gov.chooseWinningOptionFromVotes,
  createGovernanceDecisionEvent: gov.createGovernanceDecisionEvent,
  pruneGovernanceState: gov.pruneGovernanceState,
  addDays,
  getString,
  getObject
});

async function bootstrap(): Promise<void> {
  safeLogInfo("Database target resolved", { database_target: DATABASE_TARGET });
  await store.initialize();
  safeLogInfo("Store initialized", { store_backend: STORE_BACKEND });
  await ensureAdminRbacBaselineSafely();
  await configureServerRuntime(app, {
    publicDir: PUBLIC_DIR,
    cloudflareAccessEnabled: CLOUDFLARE_ACCESS_ENABLED,
    cloudflareAccessTeamDomain: CLOUDFLARE_ACCESS_TEAM_DOMAIN,
    cloudflareAccessAud: CLOUDFLARE_ACCESS_AUD,
    onWarn: (message) => safeLogWarn(message)
  });
  registerAllRoutes();
  await app.listen({ port: PORT, host: HOST });
  safeLogInfo(`Narrate licensing server started on http://${HOST}:${PORT}`);
}
async function ensureAdminRbacBaselineSafely(): Promise<void> {
  if (!ADMIN_RBAC_BOOTSTRAP) {
    return;
  }
  try {
    await ensureAdminRbacBaseline();
  } catch (error) {
    safeLogWarn("Admin RBAC bootstrap failed", { error: toErrorMessage(error) });
  }
}
function registerAllRoutes(): void {
  const staticPages: Array<[string, string]> = [
    ["/", "index.html"],
    ["/terms", "terms.html"],
    ["/privacy", "privacy.html"],
    ["/checkout/success", "checkout-success.html"],
    ["/checkout/cancel", "checkout-cancel.html"],
    ["/oauth/github/complete", "oauth-complete.html"],
    ["/oauth/google/complete", "oauth-complete.html"],
    ["/app", "app.html"]
  ];
  for (const [route, file] of staticPages) {
    app.get(route, async (_request, reply) => {
      return reply.type("text/html; charset=utf-8").sendFile(file);
    });
  }

  app.get("/health", async () => ({ ok: true }));

  registerSlackRoutes(app, {
    slackCommandsEnabled: SLACK_COMMANDS_ENABLED,
    slackSigningSecret: SLACK_SIGNING_SECRET,
    slackBotToken: SLACK_BOT_TOKEN,
    slackWebhookUrl: SLACK_WEBHOOK_URL,
    slackAllowedTeamIds: SLACK_ALLOWED_TEAM_IDS,
    slackAllowedEmails: SLACK_ALLOWED_EMAILS,
    slack,
    getOrCreateUserByEmail,
    getString
  });
  registerAuthRoutes(app, {
    store,
    githubClientId: GITHUB_CLIENT_ID,
    githubClientSecret: GITHUB_CLIENT_SECRET,
    githubRedirectUri: GITHUB_REDIRECT_URI,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
    googleRedirectUri: GOOGLE_REDIRECT_URI,
    sessionTtlHours: SESSION_TTL_HOURS,
    oauthStateTtlMinutes: OAUTH_STATE_TTL_MINUTES,
    enableEmailOtp: ENABLE_EMAIL_OTP,
    exposeDevOtpCode: EXPOSE_DEV_OTP_CODE,
    authStartRateLimitMax: AUTH_START_RATE_LIMIT_MAX,
    authStartRateLimitWindow: AUTH_START_RATE_LIMIT_WINDOW,
    authVerifyRateLimitMax: AUTH_VERIFY_RATE_LIMIT_MAX,
    authVerifyRateLimitWindow: AUTH_VERIFY_RATE_LIMIT_WINDOW,
    governanceAllowPro: GOVERNANCE_ALLOW_PRO,
    governanceSlackAddonSeatPriceCents: GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS,
    isAllowedOAuthCallbackUrl,
    consumeOAuthState,
    exchangeGitHubOAuthCode,
    exchangeGoogleOAuthCode,
    fetchGitHubProfile,
    fetchGoogleProfile,
    resolveGitHubPrimaryEmail,
    getOrCreateUserByEmail,
    replyAfterOAuth,
    setSessionCookie,
    clearSessionCookie,
    getSessionTokenFromCookie
  });
  registerAccountRoutes(app, {
    store,
    requireAuth,
    issueEntitlement,
    trialDurationHours: TRIAL_DURATION_HOURS,
    sessionTtlHours: SESSION_TTL_HOURS,
    supportsGovernancePlan: gov.supportsGovernancePlan,
    getSuperAdminEmailSet,
    resolveAdminAccessFromDb,
    governanceSeatPriceCents: GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS,
    adminRoutePrefix: ADMIN_ROUTE_PREFIX,
    cloudflareAccessEnabled: CLOUDFLARE_ACCESS_ENABLED,
    boardReadPermission: ADMIN_PERMISSION_KEYS.BOARD_READ,
    safeLogWarn,
    toErrorMessage
  });
  registerPolicyRoutes(app, {
    requireAuth,
    safeLogInfo
  });
  registerTeamRoutes(app, {
    store,
    requireAuth,
    getOrCreateUserByEmail,
    grantSubscriptionByUserId,
    upsertProviderPolicy
  });
  registerGovernanceRoutes(app, {
    requireAuth,
    store,
    resolveGovernanceContextForUser: gov.resolveGovernanceContextForUser,
    getGovernanceSettingsForScope: gov.getGovernanceSettingsForScope,
    buildDefaultGovernanceSettings: gov.buildDefaultGovernanceSettings,
    governanceSlackAddonSeatPriceCents: GOVERNANCE_SLACK_ADDON_SEAT_PRICE_CENTS,
    upsertGovernanceSettings: gov.upsertGovernanceSettings,
    normalizeGovernanceVoteMode: gov.normalizeGovernanceVoteMode,
    pruneGovernanceState: gov.pruneGovernanceState,
    dispatchSlackGovernanceNotification: slack.dispatchSlackGovernanceNotification,
    normalizeStringList: gov.normalizeStringList,
    normalizeIsoDateOrNull: gov.normalizeIsoDateOrNull,
    parseMastermindOptionsInput: gov.parseMastermindOptionsInput,
    applyMastermindThreadCreateStateUpdate: slack.applyMastermindThreadCreateStateUpdate,
    canAccessGovernanceThread: gov.canAccessGovernanceThread,
    buildMastermindThreadDetail: gov.buildMastermindThreadDetail,
    normalizeMastermindEntryType: gov.normalizeMastermindEntryType,
    resolveGovernanceSettingsForThread: gov.resolveGovernanceSettingsForThread,
    addDays,
    normalizeMastermindDecision: gov.normalizeMastermindDecision,
    applySlackDecisionStateUpdate: slack.applySlackDecisionStateUpdate,
    toErrorMessage,
    buildMastermindVoteTally: gov.buildMastermindVoteTally,
    clampInt,
    hasActiveTeamSeat,
    setGovernanceSlackAddonState: gov.setGovernanceSlackAddonState,
    requireAdminPermission,
    adminPermissionKeys: ADMIN_PERMISSION_KEYS,
    adminRoutePrefix: ADMIN_ROUTE_PREFIX,
    getSuperAdminEmailSet,
    resolveEffectivePlan,
    safeLogWarn,
    normalizeEmail
  });
  registerAdminRoutes(app, {
    store,
    requireAdminPermission,
    adminPermissionKeys: ADMIN_PERMISSION_KEYS,
    adminRoutePrefix: ADMIN_ROUTE_PREFIX,
    getOrCreateUserByEmail,
    grantSubscriptionByEmail,
    grantSubscriptionByUserId,
    upsertProviderPolicy
  });
  registerPaymentsRoutes(app, {
    requireAuth,
    store,
    stripeSecretKey: STRIPE_SECRET_KEY,
    stripeWebhookSecret: STRIPE_WEBHOOK_SECRET,
    checkoutSuccessUrl: CHECKOUT_SUCCESS_URL,
    checkoutCancelUrl: CHECKOUT_CANCEL_URL,
    resolveStripePriceId,
    safeJson,
    verifyStripeSignature,
    getObject,
    getString,
    normalizeEmail,
    asPaidPlanTier,
    asModuleScope,
    getNumber,
    grantSubscriptionByEmail,
    recordAffiliatePaidConversion,
    addDays,
    offlineRefTtlDays: OFFLINE_REF_TTL_DAYS,
    generateCode,
    requireAdminPermission,
    adminPermissionKeys: ADMIN_PERMISSION_KEYS,
    adminRoutePrefix: ADMIN_ROUTE_PREFIX,
    grantSubscriptionByUserId,
    toErrorMessage
  });
  registerAffiliateRoutes(app, {
    requireAuth,
    store,
    clampCommissionRate,
    defaultAffiliateRateBps: DEFAULT_AFFILIATE_RATE_BPS,
    generateCode,
    normalizeEmail,
    requireAdminPermission,
    adminPermissionKeys: ADMIN_PERMISSION_KEYS,
    adminRoutePrefix: ADMIN_ROUTE_PREFIX,
    recordAffiliatePaidConversion,
    toErrorMessage
  });
}
bootstrap().catch((error) => {
  console.error(sanitizeLogValue(error));
  process.exit(1);
});
