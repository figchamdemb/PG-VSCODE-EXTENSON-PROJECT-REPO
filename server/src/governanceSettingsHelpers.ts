import { randomUUID } from "crypto";
import { StoreState } from "./types";

// ---------------------------------------------------------------------------
// Deps – subset of GovernanceHelpersDeps needed for settings operations.
// ---------------------------------------------------------------------------
export interface GovernanceSettingsDeps {
  GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS: number;
  GOVERNANCE_DEFAULT_RETENTION_DAYS: number;
  GOVERNANCE_MIN_RETENTION_DAYS: number;
  GOVERNANCE_MAX_RETENTION_DAYS: number;
  GOVERNANCE_MIN_DEBATE_CHARS: number;
  GOVERNANCE_MAX_DEBATE_CHARS: number;
  clampInt: (value: number, min: number, max: number) => number;
}

// ---------------------------------------------------------------------------
// Sub-factory – governance settings CRUD + retention.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createGovernanceSettingsHelpers(deps: GovernanceSettingsDeps) {
  return {
    getGovernanceSettingsForScope: (
      state: StoreState, scopeType: "user" | "team", scopeId: string
    ) => getGovernanceSettingsForScope(state, scopeType, scopeId),
    buildDefaultGovernanceSettings: (
      scopeType: "user" | "team", scopeId: string, nowIso: string
    ) => buildDefaultGovernanceSettings(deps, scopeType, scopeId, nowIso),
    upsertGovernanceSettings: (
      state: StoreState, scopeType: "user" | "team", scopeId: string,
      patch: { slack_enabled?: boolean; slack_channel?: string | null; vote_mode?: "majority" | "single_reviewer"; retention_days?: number; max_debate_chars?: number }
    ) => upsertGovernanceSettings(deps, state, scopeType, scopeId, patch),
    setGovernanceSlackAddonState: (
      state: StoreState, scopeType: "user" | "team", scopeId: string, active: boolean
    ) => setGovernanceSlackAddonState(deps, state, scopeType, scopeId, active),
    resolveGovernanceRetentionDaysForScope: (
      state: StoreState, scopeType: "user" | "team", scopeId: string
    ) => resolveGovernanceRetentionDaysForScope(deps, state, scopeType, scopeId),
  };
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level).
// ---------------------------------------------------------------------------

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
  deps: GovernanceSettingsDeps,
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
    max_debate_chars: deps.GOVERNANCE_DEFAULT_MAX_DEBATE_CHARS,
    retention_days: deps.GOVERNANCE_DEFAULT_RETENTION_DAYS,
    created_at: nowIso,
    updated_at: nowIso
  };
}

function upsertGovernanceSettings(
  deps: GovernanceSettingsDeps,
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
      ...buildDefaultGovernanceSettings(deps, scopeType, scopeId, nowIso),
      id: randomUUID()
    };
    state.governance_settings.push(settings);
  }

  if (patch.vote_mode !== undefined) {
    settings.vote_mode = patch.vote_mode;
  }
  if (patch.retention_days !== undefined) {
    settings.retention_days = deps.clampInt(
      Math.floor(patch.retention_days),
      deps.GOVERNANCE_MIN_RETENTION_DAYS,
      deps.GOVERNANCE_MAX_RETENTION_DAYS
    );
  }
  if (patch.max_debate_chars !== undefined) {
    settings.max_debate_chars = deps.clampInt(
      Math.floor(patch.max_debate_chars),
      deps.GOVERNANCE_MIN_DEBATE_CHARS,
      deps.GOVERNANCE_MAX_DEBATE_CHARS
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
  deps: GovernanceSettingsDeps,
  state: StoreState,
  scopeType: "user" | "team",
  scopeId: string,
  active: boolean
): StoreState["governance_settings"][number] {
  const settings = upsertGovernanceSettings(deps, state, scopeType, scopeId, {});
  settings.slack_addon_active = active;
  if (!active) {
    settings.slack_enabled = false;
  }
  settings.updated_at = new Date().toISOString();
  return settings;
}

function resolveGovernanceRetentionDaysForScope(
  deps: GovernanceSettingsDeps,
  state: StoreState,
  scopeType: "user" | "team",
  scopeId: string
): number {
  const settings = getGovernanceSettingsForScope(state, scopeType, scopeId);
  if (!settings) {
    return deps.GOVERNANCE_DEFAULT_RETENTION_DAYS;
  }
  return deps.clampInt(
    settings.retention_days,
    deps.GOVERNANCE_MIN_RETENTION_DAYS,
    deps.GOVERNANCE_MAX_RETENTION_DAYS
  );
}
