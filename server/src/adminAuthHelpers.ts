import { PrismaClient } from "@prisma/client";
import { FastifyReply, FastifyRequest } from "fastify";
import {
  AdminPermissionKeys,
  ensureAdminRbacBaseline as ensureAdminRbacBaselineImpl
} from "./adminRbacBootstrap";
import {
  AdminAuthMode,
  defaultAdminNameFromEmail,
  normalizeEmail,
  toErrorMessage
} from "./serverUtils";
import { SessionRecord, UserRecord } from "./types";

// ---------------------------------------------------------------------------
// Deps – subset of CreateSessionAuthHelpersDeps plus runtime helpers.
// ---------------------------------------------------------------------------
export interface AdminAuthHelpersDeps {
  prisma: PrismaClient;
  adminKey: string;
  adminAuthMode: AdminAuthMode;
  adminPermissionKeys: AdminPermissionKeys;
  cloudflareAccessEnabled: boolean;
  superAdminEmails: Set<string>;
  superAdminSource: "env" | "db" | "both";
  adminBootstrapSuperAdminEmails: Set<string>;
  safeLogWarn: (message: string, context: Record<string, unknown>) => void;
  /** Provided by the parent factory at construction time. */
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply,
    options?: { silent?: boolean }
  ) => { session: SessionRecord; user: UserRecord } | undefined;
  /** Provided by the parent factory at construction time. */
  requireCloudflareAccess: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => Promise<boolean>;
}

type AdminAccessContext = {
  mode: "db" | "key";
  isSuperAdmin: boolean;
  permissions: Set<string>;
  userEmail?: string;
};

// ---------------------------------------------------------------------------
// Sub-factory – admin RBAC + super-admin helpers.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createAdminAuthHelpers(deps: AdminAuthHelpersDeps) {
  return {
    isAdminAuthorized: (request: FastifyRequest) =>
      isAdminAuthorized(deps, request),
    requireAdminPermission: (
      request: FastifyRequest, reply: FastifyReply, permission: string
    ) => requireAdminPermission(deps, request, reply, permission),
    resolveAdminAccessFromDb: (email: string) =>
      resolveAdminAccessFromDb(deps, email),
    ensureAdminRbacBaseline: () =>
      ensureAdminRbacBaseline(deps),
    getSuperAdminEmailSet: () =>
      getSuperAdminEmailSet(deps),
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level).
// ---------------------------------------------------------------------------

function isAdminAuthorized(
  deps: AdminAuthHelpersDeps,
  request: FastifyRequest
): boolean {
  const key = request.headers["x-admin-key"];
  if (Array.isArray(key)) {
    return key.includes(deps.adminKey);
  }
  return key === deps.adminKey;
}

async function requireAdminPermission(
  deps: AdminAuthHelpersDeps,
  request: FastifyRequest,
  reply: FastifyReply,
  permission: string
): Promise<AdminAccessContext | undefined> {
  if (deps.cloudflareAccessEnabled) {
    const cfAccess = await deps.requireCloudflareAccess(request, reply);
    if (!cfAccess) {
      return undefined;
    }
  }
  const keyAuthorized = isAdminAuthorized(deps, request);
  if (deps.adminAuthMode === "key") {
    if (!keyAuthorized) {
      reply.code(401).send({ error: "admin key required" });
      return undefined;
    }
    return {
      mode: "key",
      isSuperAdmin: true,
      permissions: new Set(Object.values(deps.adminPermissionKeys))
    };
  }

  const auth = deps.requireAuth(request, reply, {
    silent: deps.adminAuthMode === "hybrid"
  });
  if (!auth) {
    if (deps.adminAuthMode === "hybrid" && keyAuthorized) {
      return {
        mode: "key",
        isSuperAdmin: true,
        permissions: new Set(Object.values(deps.adminPermissionKeys))
      };
    }
    if (deps.adminAuthMode === "hybrid") {
      reply.code(401).send({ error: "admin authentication required" });
    }
    return undefined;
  }

  let access: Awaited<ReturnType<typeof resolveAdminAccessFromDb>> | null = null;
  try {
    access = await resolveAdminAccessFromDb(deps, auth.user.email);
  } catch (error) {
    deps.safeLogWarn("Failed to resolve admin RBAC access from DB", {
      error: toErrorMessage(error)
    });
    if (deps.adminAuthMode === "db") {
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

  if (deps.adminAuthMode === "hybrid" && keyAuthorized) {
    return {
      mode: "key",
      isSuperAdmin: true,
      permissions: new Set(Object.values(deps.adminPermissionKeys)),
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
  deps: AdminAuthHelpersDeps,
  email: string
): Promise<{ isSuperAdmin: boolean; permissions: Set<string> } | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const account = await deps.prisma.adminAccount.findFirst({
    where: { email: normalizedEmail, status: "active" },
    select: { id: true, isSuperAdmin: true }
  });
  if (!account) {
    return null;
  }

  const roleRows = await deps.prisma.adminAccountRole.findMany({
    where: { adminAccountId: account.id, revokedAt: null },
    select: { roleId: true }
  });
  const roleIds = [...new Set(roleRows.map((row) => row.roleId))];
  const permissions = new Set<string>();

  if (roleIds.length > 0) {
    const rolePermissionRows = await deps.prisma.adminRolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: { permissionId: true }
    });
    const permissionIds = [
      ...new Set(rolePermissionRows.map((row) => row.permissionId))
    ];
    if (permissionIds.length > 0) {
      const permissionRows = await deps.prisma.adminPermission.findMany({
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

async function ensureAdminRbacBaseline(deps: AdminAuthHelpersDeps): Promise<void> {
  await ensureAdminRbacBaselineImpl({
    prisma: deps.prisma,
    permissionKeys: deps.adminPermissionKeys,
    bootstrapSuperAdminEmails: deps.adminBootstrapSuperAdminEmails,
    defaultAdminNameFromEmail
  });
}

async function getSuperAdminEmailSet(deps: AdminAuthHelpersDeps): Promise<Set<string>> {
  const superAdminEmails = new Set<string>();
  if (deps.superAdminSource !== "db") {
    deps.superAdminEmails.forEach((email) => superAdminEmails.add(email));
  }

  if (deps.superAdminSource !== "env") {
    try {
      const rows = await deps.prisma.adminAccount.findMany({
        where: { status: "active", isSuperAdmin: true },
        select: { email: true }
      });
      appendNormalizedEmails(superAdminEmails, rows.map((row) => row.email));
    } catch (error) {
      deps.safeLogWarn("Failed to load super-admin emails from DB", {
        error: toErrorMessage(error),
        source: deps.superAdminSource
      });
      if (deps.superAdminSource === "db") {
        return new Set<string>();
      }
    }
  }
  return superAdminEmails;
}

function appendNormalizedEmails(target: Set<string>, emails: string[]): void {
  for (const email of emails) {
    const normalized = normalizeEmail(email);
    if (normalized) {
      target.add(normalized);
    }
  }
}
