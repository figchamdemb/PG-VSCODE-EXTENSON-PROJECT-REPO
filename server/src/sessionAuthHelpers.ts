import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";
import { AdminPermissionKeys } from "./adminRbacBootstrap";
import { createAdminAuthHelpers } from "./adminAuthHelpers";
import { createCloudflareAccessHelpers } from "./cloudflareAccessHelpers";
import { StateStore } from "./store";
import {
  buildEntitlementClaims,
  ensureDeviceRecord,
  ensureQuotaRecord,
  signEntitlementToken
} from "./entitlementHelpers";
import {
  AdminAuthMode,
  getBearerToken,
  toErrorMessage
} from "./serverUtils";
import { PLAN_RULES } from "./rules";
import { SessionRecord, UserRecord } from "./types";

export interface CreateSessionAuthHelpersDeps {
  store: StateStore;
  prisma: PrismaClient;
  cloudflareAccessTeamDomain: string;
  cloudflareAccessAud: string;
  cloudflareAccessJwksTtlSeconds: number;
  cloudflareAccessEnabled: boolean;
  adminKey: string;
  adminAuthMode: AdminAuthMode;
  adminPermissionKeys: AdminPermissionKeys;
  sessionCookieName: string;
  sessionCookieSecure: boolean;
  sessionCookieSameSite: "strict" | "lax" | "none";
  sessionTtlHours: number;
  superAdminEmails: Set<string>;
  superAdminSource: "env" | "db" | "both";
  adminBootstrapSuperAdminEmails: Set<string>;
  safeLogWarn: (
    message: string,
    context: Record<string, unknown>
  ) => void;
  isAllowedOAuthCallbackUrl: (callbackUrl: string) => boolean;
}

// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createSessionAuthHelpers(
  deps: CreateSessionAuthHelpersDeps
) {
  const { requireCloudflareAccess } = createCloudflareAccessHelpers({
    cloudflareAccessTeamDomain: deps.cloudflareAccessTeamDomain,
    cloudflareAccessAud: deps.cloudflareAccessAud,
    cloudflareAccessJwksTtlSeconds: deps.cloudflareAccessJwksTtlSeconds
  });

  const adminAuth = createAdminAuthHelpers({
    prisma: deps.prisma,
    adminKey: deps.adminKey,
    adminAuthMode: deps.adminAuthMode,
    adminPermissionKeys: deps.adminPermissionKeys,
    cloudflareAccessEnabled: deps.cloudflareAccessEnabled,
    superAdminEmails: deps.superAdminEmails,
    superAdminSource: deps.superAdminSource,
    adminBootstrapSuperAdminEmails: deps.adminBootstrapSuperAdminEmails,
    safeLogWarn: deps.safeLogWarn,
    requireAuth: (request, reply, options) => requireAuth(deps, request, reply, options),
    requireCloudflareAccess
  });

  return {
    requireCloudflareAccess,
    issueEntitlement: (
      request: FastifyRequest<{ Body: { install_id?: string; device_label?: string } }>,
      reply: FastifyReply,
      source: "activate" | "refresh"
    ) => issueEntitlement(deps, request, reply, source),
    requireAuth: (
      request: FastifyRequest, reply: FastifyReply, options?: { silent?: boolean }
    ) => requireAuth(deps, request, reply, options),
    ...adminAuth,
    getSessionTokenFromCookie: (request: FastifyRequest) =>
      getSessionTokenFromCookie(deps, request),
    setSessionCookie: (reply: FastifyReply, request: FastifyRequest, token: string) =>
      setSessionCookie(deps, reply, request, token),
    clearSessionCookie: (reply: FastifyReply, request: FastifyRequest) =>
      clearSessionCookie(deps, reply, request),
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level).
// ---------------------------------------------------------------------------

async function issueEntitlement(
  deps: CreateSessionAuthHelpersDeps,
  request: FastifyRequest<{
    Body: {
      install_id?: string;
      device_label?: string;
    };
  }>,
  reply: FastifyReply,
  source: "activate" | "refresh"
): Promise<void | object> {
  const auth = requireAuth(deps, request, reply);
  if (!auth) {
    return;
  }
  const installId = request.body?.install_id?.trim();
  if (!installId) {
    return reply
      .code(400)
      .send({ error: "install_id is required" });
  }
  const deviceLabel =
    request.body?.device_label?.trim() ||
    `${source}:${process.platform}`;

  const snapshotBefore = deps.store.snapshot();
  const claimsBefore = buildEntitlementClaims(
    snapshotBefore,
    auth.user.id,
    installId
  );
  const deviceLimit =
    PLAN_RULES[claimsBefore.plan].device_limit;

  try {
    await deps.store.update((state) => {
      ensureDeviceRecord(
        state,
        auth.user.id,
        installId,
        deviceLabel,
        deviceLimit
      );
      ensureQuotaRecord(
        state,
        auth.user.id,
        claimsBefore.plan
      );
    });
  } catch (error) {
    return reply
      .code(403)
      .send({ error: toErrorMessage(error) });
  }

  const snapshotAfter = deps.store.snapshot();
  const claims = buildEntitlementClaims(
    snapshotAfter,
    auth.user.id,
    installId
  );
  const token = signEntitlementToken(snapshotAfter, claims);
  return {
    entitlement_token: token,
    expires_at: new Date(claims.exp * 1000).toISOString()
  };
}

function requireAuth(
  deps: CreateSessionAuthHelpersDeps,
  request: FastifyRequest,
  reply: FastifyReply,
  options?: { silent?: boolean }
):
  | { session: SessionRecord; user: UserRecord }
  | undefined {
  const silent = options?.silent === true;
  const token =
    getBearerToken(request.headers.authorization) ||
    getSessionTokenFromCookie(deps, request);
  if (!token) {
    if (!silent) {
      reply
        .code(401)
        .send({ error: "missing auth token" });
    }
    return undefined;
  }

  const snapshot = deps.store.snapshot();
  const session = snapshot.sessions.find(
    (item) => item.token === token
  );
  if (!session) {
    if (!silent) {
      reply
        .code(401)
        .send({ error: "invalid bearer token" });
    }
    return undefined;
  }
  if (
    new Date(session.expires_at).getTime() < Date.now()
  ) {
    if (!silent) {
      reply
        .code(401)
        .send({ error: "session expired" });
    }
    return undefined;
  }

  const user = snapshot.users.find(
    (item) => item.id === session.user_id
  );
  if (!user) {
    if (!silent) {
      reply
        .code(401)
        .send({ error: "session user not found" });
    }
    return undefined;
  }
  return { session, user };
}

function getSessionTokenFromCookie(
  deps: CreateSessionAuthHelpersDeps,
  request: FastifyRequest
): string | undefined {
  const cookieValue =
    request.cookies?.[deps.sessionCookieName];
  if (typeof cookieValue !== "string") {
    return undefined;
  }
  const value = cookieValue.trim();
  return value || undefined;
}

function setSessionCookie(
  deps: CreateSessionAuthHelpersDeps,
  reply: FastifyReply,
  request: FastifyRequest,
  token: string
): void {
  const secure =
    deps.sessionCookieSecure ||
    isSecureRequest(request);
  reply.setCookie(deps.sessionCookieName, token, {
    path: "/",
    httpOnly: true,
    sameSite: deps.sessionCookieSameSite,
    secure,
    maxAge: deps.sessionTtlHours * 60 * 60
  });
}

function clearSessionCookie(
  deps: CreateSessionAuthHelpersDeps,
  reply: FastifyReply,
  request: FastifyRequest
): void {
  const secure =
    deps.sessionCookieSecure ||
    isSecureRequest(request);
  reply.clearCookie(deps.sessionCookieName, {
    path: "/",
    httpOnly: true,
    sameSite: deps.sessionCookieSameSite,
    secure
  });
}

function isSecureRequest(
  request: FastifyRequest
): boolean {
  const proto = request.headers["x-forwarded-proto"];
  if (typeof proto === "string") {
    return (
      proto.split(",")[0].trim().toLowerCase() ===
      "https"
    );
  }
  if (Array.isArray(proto) && proto.length > 0) {
    return (
      proto[0].trim().toLowerCase() === "https"
    );
  }
  return request.protocol === "https";
}
