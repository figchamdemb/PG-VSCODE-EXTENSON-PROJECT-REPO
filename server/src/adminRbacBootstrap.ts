import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

export interface AdminPermissionKeys {
  BOARD_READ: string;
  BOARD_SUPPORT_WRITE: string;
  BOARD_SUBSCRIPTION_WRITE: string;
  BOARD_SESSION_REVOKE: string;
  REFUND_APPROVE: string;
  SUBSCRIPTION_GRANT: string;
  TEAM_MANAGE: string;
  PROVIDER_POLICY_MANAGE: string;
  OFFLINE_PAYMENT_REVIEW: string;
  AFFILIATE_MANAGE: string;
}

export const ADMIN_PERMISSION_KEYS: AdminPermissionKeys = {
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

interface EnsureAdminRbacBaselineOptions {
  prisma: PrismaClient;
  permissionKeys: AdminPermissionKeys;
  bootstrapSuperAdminEmails: Set<string>;
  defaultAdminNameFromEmail: (email: string) => string;
}

interface RoleDefinition {
  roleKey: string;
  displayName: string;
  description: string;
  permissions: string[];
}

export async function ensureAdminRbacBaseline(
  options: EnsureAdminRbacBaselineOptions
): Promise<void> {
  const now = new Date();
  const permissionIdByKey = await upsertPermissions(options.prisma, options.permissionKeys, now);
  const roleIdByKey = await upsertRoles(
    options.prisma,
    buildRoleDefinitions(options.permissionKeys),
    permissionIdByKey,
    now
  );
  await ensureSuperAdminAssignments(options, roleIdByKey.get("pg_global_super_admin"), now);
}

function buildPermissionDefinitions(
  keys: AdminPermissionKeys
): Array<{ key: string; description: string }> {
  return [
    { key: keys.BOARD_READ, description: "Read global admin board dashboards." },
    { key: keys.BOARD_SUPPORT_WRITE, description: "Update support ticket states from admin board." },
    { key: keys.BOARD_SUBSCRIPTION_WRITE, description: "Revoke subscriptions from admin board." },
    { key: keys.BOARD_SESSION_REVOKE, description: "Revoke user sessions from admin board." },
    { key: keys.REFUND_APPROVE, description: "Approve refund requests." },
    { key: keys.SUBSCRIPTION_GRANT, description: "Grant manual subscriptions." },
    { key: keys.TEAM_MANAGE, description: "Create and manage enterprise teams." },
    { key: keys.PROVIDER_POLICY_MANAGE, description: "Set team or user provider policy constraints." },
    { key: keys.OFFLINE_PAYMENT_REVIEW, description: "Approve or reject offline payment references." },
    { key: keys.AFFILIATE_MANAGE, description: "Confirm affiliate conversions and approve payouts." }
  ];
}

async function upsertPermissions(
  prisma: PrismaClient,
  keys: AdminPermissionKeys,
  now: Date
): Promise<Map<string, string>> {
  const permissionIdByKey = new Map<string, string>();
  const rows = await Promise.all(
    buildPermissionDefinitions(keys).map(async (permission) => {
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
      return { key: permission.key, id: row.id };
    })
  );
  rows.forEach((row) => permissionIdByKey.set(row.key, row.id));
  return permissionIdByKey;
}

function buildRoleDefinitions(keys: AdminPermissionKeys): RoleDefinition[] {
  return [
    {
      roleKey: "pg_global_super_admin",
      displayName: "PG Global Super Admin",
      description: "Full access to all PG global operational controls.",
      permissions: Object.values(keys)
    },
    {
      roleKey: "pg_support_admin",
      displayName: "PG Support Admin",
      description: "Support operations and payment review controls.",
      permissions: [keys.BOARD_READ, keys.BOARD_SUPPORT_WRITE, keys.OFFLINE_PAYMENT_REVIEW, keys.REFUND_APPROVE]
    }
  ];
}

async function upsertRoles(
  prisma: PrismaClient,
  roleDefinitions: RoleDefinition[],
  permissionIdByKey: Map<string, string>,
  now: Date
): Promise<Map<string, string>> {
  const roleIdByKey = new Map<string, string>();
  const rows = await Promise.all(
    roleDefinitions.map(async (roleDefinition) => {
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
      await ensureRolePermissions(prisma, role.id, roleDefinition.permissions, permissionIdByKey, now);
      return { key: roleDefinition.roleKey, id: role.id };
    })
  );
  rows.forEach((row) => roleIdByKey.set(row.key, row.id));
  return roleIdByKey;
}

async function ensureRolePermissions(
  prisma: PrismaClient,
  roleId: string,
  permissionKeys: string[],
  permissionIdByKey: Map<string, string>,
  now: Date
): Promise<void> {
  await Promise.all(
    permissionKeys.map(async (permissionKey) => {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) {
        return;
      }
      const existing = await prisma.adminRolePermission.findFirst({
        where: { roleId, permissionId },
        select: { id: true }
      });
      if (!existing) {
        await prisma.adminRolePermission.create({
          data: { id: randomUUID(), roleId, permissionId, createdAt: now }
        });
      }
    })
  );
}

async function ensureSuperAdminAssignments(
  options: EnsureAdminRbacBaselineOptions,
  superAdminRoleId: string | undefined,
  now: Date
): Promise<void> {
  if (!superAdminRoleId || options.bootstrapSuperAdminEmails.size === 0) {
    return;
  }
  await Promise.all(
    [...options.bootstrapSuperAdminEmails].map(async (email) => {
      const account = await upsertSuperAdminAccount(options, email, now);
      await ensureSuperAdminRoleAssignment(options.prisma, account.id, superAdminRoleId, now);
    })
  );
}

async function upsertSuperAdminAccount(
  options: EnsureAdminRbacBaselineOptions,
  email: string,
  now: Date
): Promise<{ id: string }> {
  return options.prisma.adminAccount.upsert({
    where: { email },
    update: { status: "active", isSuperAdmin: true, updatedAt: now },
    create: {
      id: randomUUID(),
      email,
      fullName: options.defaultAdminNameFromEmail(email),
      status: "active",
      isSuperAdmin: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null
    },
    select: { id: true }
  });
}

async function ensureSuperAdminRoleAssignment(
  prisma: PrismaClient,
  adminAccountId: string,
  roleId: string,
  now: Date
): Promise<void> {
  const existing = await prisma.adminAccountRole.findFirst({
    where: { adminAccountId, roleId },
    select: { id: true, revokedAt: true }
  });
  if (!existing) {
    await prisma.adminAccountRole.create({
      data: {
        id: randomUUID(),
        adminAccountId,
        roleId,
        scopeId: null,
        assignedByAdminId: null,
        createdAt: now,
        revokedAt: null
      }
    });
    return;
  }
  if (existing.revokedAt !== null) {
    await prisma.adminAccountRole.update({
      where: { id: existing.id },
      data: { revokedAt: null }
    });
  }
}
