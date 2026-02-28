/**
 * teamHelpers.ts — Pure team management / support normalizer functions.
 * Extracted from index.ts for COD-LIMIT-001 compliance.
 * All functions are stateless — they accept state explicitly.
 */

import { StoreState } from "./types";

/* ── Team role helpers ────────────────────────────────────── */

export function canManageTeamRole(
  role: StoreState["team_memberships"][number]["role"]
): boolean {
  return role === "owner" || role === "manager";
}

export function teamRoleRank(role: StoreState["team_memberships"][number]["role"]): number {
  if (role === "owner") {
    return 0;
  }
  if (role === "manager") {
    return 1;
  }
  return 2;
}

export function hasActiveTeamSeat(state: StoreState, teamId: string, userId: string): boolean {
  return state.team_memberships.some(
    (item) =>
      item.team_id === teamId &&
      item.user_id === userId &&
      item.status === "active" &&
      item.revoked_at === null
  );
}

/* ── Team access resolution ───────────────────────────────── */

export function resolveTeamAccessForUser(
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

/* ── Team status payload ──────────────────────────────────── */

export function buildTeamStatusPayload(
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

/* ── Support normalizers ──────────────────────────────────── */

export function normalizeSupportCategory(
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

export function normalizeSupportSeverity(
  value: string | undefined
): "low" | "medium" | "high" | undefined {
  const candidate = value?.trim().toLowerCase();
  if (candidate === "low" || candidate === "medium" || candidate === "high") {
    return candidate;
  }
  return undefined;
}
