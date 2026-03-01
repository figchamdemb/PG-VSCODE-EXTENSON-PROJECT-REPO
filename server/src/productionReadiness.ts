/**
 * productionReadiness.ts – Startup environment validation for production safety.
 *
 * Called once during bootstrap; logs warnings or throws (in strict mode) when
 * insecure defaults or missing credentials are detected.
 */

/* ── Types ────────────────────────────────────────────────────────── */

export interface ProductionReadinessOptions {
  nodeEnv: string;
  storeBackend: string;
  adminKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  githubClientId: string;
  githubClientSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  sessionCookieSecure: boolean;
  exposeDevOtpCode: boolean;
  adminAuthMode: string;
  publicBaseUrl: string;
  databaseUrl: string;
  slackSigningSecret: string;
  slackCommandsEnabled: boolean;
  host: string;
  port: number;
}

export interface ReadinessCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/* ── Core ─────────────────────────────────────────────────────────── */

export function validateProductionReadiness(
  opts: ProductionReadinessOptions
): ReadinessCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = opts.nodeEnv === "production";

  // --- Critical (errors in prod, warnings in dev) ---
  addCheck(
    opts.adminKey === "dev-admin-key",
    "ADMIN_KEY is still the default 'dev-admin-key'",
    isProd,
    errors,
    warnings
  );
  addCheck(
    opts.exposeDevOtpCode,
    "EXPOSE_DEV_OTP_CODE=true leaks OTP codes in responses",
    isProd,
    errors,
    warnings
  );
  addCheck(
    !opts.sessionCookieSecure,
    "SESSION_COOKIE_SECURE=false – cookies sent over plain HTTP",
    isProd,
    errors,
    warnings
  );
  addCheck(
    opts.publicBaseUrl.startsWith("http://") && isProd,
    "PUBLIC_BASE_URL uses http:// in production – should be https://",
    isProd,
    errors,
    warnings
  );

  // --- Auth/payment credentials ---
  addCheck(
    !opts.stripeSecretKey,
    "STRIPE_SECRET_KEY is empty – checkout will fail",
    isProd,
    errors,
    warnings
  );
  addCheck(
    !opts.stripeWebhookSecret,
    "STRIPE_WEBHOOK_SECRET is empty – webhooks unverified",
    isProd,
    errors,
    warnings
  );
  addCheck(
    !opts.githubClientId || !opts.githubClientSecret,
    "GitHub OAuth credentials missing – GitHub sign-in disabled",
    false,
    errors,
    warnings
  );
  addCheck(
    !opts.googleClientId || !opts.googleClientSecret,
    "Google OAuth credentials missing – Google sign-in disabled",
    false,
    errors,
    warnings
  );

  // --- DB config ---
  addCheck(
    opts.storeBackend !== "prisma" && isProd,
    "STORE_BACKEND=json in production – use prisma for persistence",
    isProd,
    errors,
    warnings
  );
  addCheck(
    !opts.databaseUrl && opts.storeBackend === "prisma",
    "DATABASE_URL is empty while STORE_BACKEND=prisma",
    true,
    errors,
    warnings
  );

  // --- Slack ---
  addCheck(
    opts.slackCommandsEnabled && !opts.slackSigningSecret,
    "SLACK_COMMANDS_ENABLED=true but SLACK_SIGNING_SECRET is empty – signatures will fail",
    true,
    errors,
    warnings
  );

  // --- Admin auth ---
  addCheck(
    opts.adminAuthMode === "key" && isProd,
    "ADMIN_AUTH_MODE=key in production – prefer db or hybrid for RBAC enforcement",
    isProd,
    errors,
    warnings
  );

  // --- Network ---
  addCheck(
    opts.host === "0.0.0.0" && !isProd,
    "HOST=0.0.0.0 in a non-production environment – binding all interfaces",
    false,
    errors,
    warnings
  );

  return { ok: errors.length === 0, errors, warnings };
}

/* ── Runner (orchestrates validate + log + throw) ─────────────────── */

export function runProductionReadinessCheck(
  opts: ProductionReadinessOptions,
  logWarn: (message: string) => void,
  logError: (message: string) => void
): void {
  const result = validateProductionReadiness(opts);
  for (const w of result.warnings) { logWarn(`[readiness] ${w}`); }
  for (const e of result.errors) { logError(`[readiness] ${e}`); }
  if (!result.ok && opts.nodeEnv === "production") {
    throw new Error(`Production readiness check failed: ${result.errors.join("; ")}`);
  }
}

/* ── Helper ───────────────────────────────────────────────────────── */

function addCheck(
  condition: boolean,
  message: string,
  isError: boolean,
  errors: string[],
  warnings: string[]
): void {
  if (!condition) {
    return;
  }
  if (isError) {
    errors.push(message);
  } else {
    warnings.push(message);
  }
}
