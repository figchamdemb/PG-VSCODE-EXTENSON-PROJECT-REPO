export function createTeamGovernanceOps(ctx) {
  return {
    createTeam: () => createTeam(ctx),
    loadTeamStatus: () => loadTeamStatus(ctx),
    assignTeamSeat: () => assignTeamSeat(ctx),
    revokeTeamSeat: () => revokeTeamSeat(ctx),
    applyTeamPolicy: () => applyTeamPolicy(ctx),
    loadGovernanceSettings: () => loadGovernanceSettings(ctx),
    saveGovernanceSettings: () => saveGovernanceSettings(ctx),
    sendGovernanceSlackTest: () => sendGovernanceSlackTest(ctx),
    submitEodReport: () => submitEodReport(ctx),
    loadEodReports: () => loadEodReports(ctx),
    createMastermindThread: () => createMastermindThread(ctx),
    loadMastermindThreads: () => loadMastermindThreads(ctx),
    loadMastermindThreadDetail: () => loadMastermindThreadDetail(ctx),
    addMastermindEntry: () => addMastermindEntry(ctx),
    castMastermindVote: () => castMastermindVote(ctx),
    finalizeMastermindDecision: () => finalizeMastermindDecision(ctx),
    pullGovernanceSync: () => pullGovernanceSync(ctx)
  };
}

async function createTeam(ctx) {
  const { $, api, write, loadAccountSummary } = ctx;
  try {
    const result = await api("/account/team/create", "POST", {
      team_key: ($("teamKeyCreateInput")?.value || "").trim().toUpperCase(),
      plan_id: $("teamPlanSelect")?.value,
      module_scope: $("teamModuleSelect")?.value,
      seat_limit: Number($("teamSeatLimitInput")?.value || 5),
      years: Number($("teamYearsInput")?.value || 1)
    });
    updateTeamKeyInputs($, result.team_key);
    write("Team created.", result);
    await loadTeamStatus(ctx);
    await loadAccountSummary();
  } catch (error) {
    write("Team creation failed.", { error: String(error.message || error) });
  }
}

function updateTeamKeyInputs(getById, teamKey) {
  if (typeof teamKey !== "string") {
    return;
  }
  if (getById("teamKeyCreateInput")) {
    getById("teamKeyCreateInput").value = teamKey;
  }
  if (getById("teamKeyManageInput")) {
    getById("teamKeyManageInput").value = teamKey;
  }
}

async function loadTeamStatus(ctx) {
  const { api, write, writePanel, teamOutput, activeTeamKey } = ctx;
  const teamKey = activeTeamKey();
  const query = teamKey ? `?team_key=${encodeURIComponent(teamKey)}` : "";
  try {
    const result = await api(`/account/team/status${query}`);
    writePanel(teamOutput, result, "No team data loaded.");
    write("Team status loaded.", result);
  } catch (error) {
    write("Team status failed.", { error: String(error.message || error) });
  }
}

async function assignTeamSeat(ctx) {
  const { $, api, write, activeTeamKey } = ctx;
  const email = ($("teamMemberEmailInput")?.value || "").trim();
  if (!email) {
    write("Team member email is required.");
    return;
  }
  try {
    const result = await api("/account/team/assign-seat", "POST", {
      team_key: activeTeamKey(),
      email,
      role: $("teamMemberRoleSelect")?.value || "member",
      years: Number($("teamMemberYearsInput")?.value || 1)
    });
    write("Team seat assigned.", result);
    await loadTeamStatus(ctx);
  } catch (error) {
    write("Assign seat failed.", { error: String(error.message || error) });
  }
}

async function revokeTeamSeat(ctx) {
  const { $, api, write, activeTeamKey } = ctx;
  const email = ($("teamMemberEmailInput")?.value || "").trim();
  if (!email) {
    write("Team member email is required.");
    return;
  }
  try {
    const result = await api("/account/team/revoke-seat", "POST", {
      team_key: activeTeamKey(),
      email
    });
    write("Team seat revoked.", result);
    await loadTeamStatus(ctx);
  } catch (error) {
    write("Revoke seat failed.", { error: String(error.message || error) });
  }
}

async function applyTeamPolicy(ctx) {
  const { $, api, write, parseBool, parseList, activeTeamKey } = ctx;
  try {
    const result = await api("/account/team/provider-policy/set", "POST", {
      team_key: activeTeamKey(),
      local_only: parseBool($("policyLocalOnlySelect")?.value),
      byo_allowed: parseBool($("policyByoAllowedSelect")?.value),
      allowlist: parseList($("policyAllowlistInput")?.value),
      denylist: parseList($("policyDenylistInput")?.value)
    });
    write("Team provider policy applied.", result);
    await loadTeamStatus(ctx);
  } catch (error) {
    write("Team policy update failed.", { error: String(error.message || error) });
  }
}

async function loadGovernanceSettings(ctx) {
  const { $, api, write, writePanel, teamOutput, activeTeamKey } = ctx;
  const teamKey = activeTeamKey();
  const query = teamKey ? `?team_key=${encodeURIComponent(teamKey)}` : "";
  try {
    const result = await api(`/account/governance/settings${query}`);
    updateGovernanceSettingsInputs($, result?.settings);
    writePanel(teamOutput, result, "No governance settings loaded.");
    write("Governance settings loaded.", result);
  } catch (error) {
    write("Load governance settings failed.", { error: String(error.message || error) });
  }
}

function updateGovernanceSettingsInputs(getById, settings) {
  if (!settings) {
    return;
  }
  if (getById("govSlackEnabledSelect")) {
    getById("govSlackEnabledSelect").value = settings.slack_enabled ? "true" : "false";
  }
  if (getById("govSlackChannelInput")) {
    getById("govSlackChannelInput").value = settings.slack_channel || "";
  }
  if (getById("govVoteModeSelect")) {
    getById("govVoteModeSelect").value = settings.vote_mode || "majority";
  }
  if (getById("govRetentionDaysInput")) {
    getById("govRetentionDaysInput").value = String(settings.retention_days || 7);
  }
  if (getById("govMaxCharsInput")) {
    getById("govMaxCharsInput").value = String(settings.max_debate_chars || 4000);
  }
}

async function saveGovernanceSettings(ctx) {
  const { $, api, write, writePanel, teamOutput, parseBool, activeTeamKey } = ctx;
  try {
    const result = await api("/account/governance/settings/update", "POST", {
      team_key: activeTeamKey(),
      slack_enabled: parseBool($("govSlackEnabledSelect")?.value),
      slack_channel: ($("govSlackChannelInput")?.value || "").trim() || null,
      vote_mode: $("govVoteModeSelect")?.value || "majority",
      retention_days: Number($("govRetentionDaysInput")?.value || 7),
      max_debate_chars: Number($("govMaxCharsInput")?.value || 4000)
    });
    writePanel(teamOutput, result, "No governance settings saved.");
    write("Governance settings saved.", result);
  } catch (error) {
    write("Save governance settings failed.", { error: String(error.message || error) });
  }
}

async function sendGovernanceSlackTest(ctx) {
  const { $, api, write, activeTeamKey } = ctx;
  const message = ($("govSlackTestMessageInput")?.value || "").trim();
  if (!message) {
    write("Slack test message is required.");
    return;
  }
  try {
    const result = await api("/account/governance/slack/test", "POST", {
      team_key: activeTeamKey(),
      message
    });
    write("Slack test dispatched.", result);
  } catch (error) {
    write("Slack test failed.", { error: String(error.message || error) });
  }
}

async function submitEodReport(ctx) {
  const { $, api, write, parseList, activeTeamKey } = ctx;
  const title = ($("govEodTitleInput")?.value || "").trim();
  const summary = ($("govEodSummaryInput")?.value || "").trim();
  if (!title || !summary) {
    write("EOD title and summary are required.");
    return;
  }
  try {
    const result = await api("/account/governance/eod/report", "POST", {
      team_key: activeTeamKey(),
      title,
      summary,
      changed_files: parseList($("govEodChangedInput")?.value),
      blockers: parseList($("govEodBlockersInput")?.value),
      source: $("govEodSourceSelect")?.value || "human",
      agent_name: ($("govEodAgentInput")?.value || "").trim() || null
    });
    write("EOD report submitted.", result);
    await loadEodReports(ctx);
  } catch (error) {
    write("EOD submit failed.", { error: String(error.message || error) });
  }
}

async function loadEodReports(ctx) {
  const { api, write, writePanel, teamOutput, activeTeamKey } = ctx;
  const teamKey = activeTeamKey();
  const query = teamKey ? `?team_key=${encodeURIComponent(teamKey)}` : "";
  try {
    const result = await api(`/account/governance/eod/list${query}`);
    writePanel(teamOutput, result, "No EOD reports loaded.");
    write("EOD reports loaded.", result);
  } catch (error) {
    write("Load EOD reports failed.", { error: String(error.message || error) });
  }
}

async function createMastermindThread(ctx) {
  const { $, api, write, activeTeamKey } = ctx;
  const title = ($("govThreadTitleInput")?.value || "").trim();
  const question = ($("govThreadQuestionInput")?.value || "").trim();
  if (!title || !question) {
    write("Mastermind title and question are required.");
    return;
  }
  const options = parseMastermindOptions($("govThreadOptionsInput")?.value);
  if (options.length < 2) {
    write("Provide at least two mastermind options.");
    return;
  }
  try {
    const result = await api("/account/governance/mastermind/thread/create", "POST", {
      team_key: activeTeamKey(),
      title,
      question,
      vote_mode: $("govVoteModeSelect")?.value || "majority",
      options
    });
    if (typeof result.thread_id === "string" && $("govThreadIdInput")) {
      $("govThreadIdInput").value = result.thread_id;
    }
    write("Mastermind thread created.", result);
    await loadMastermindThreads(ctx);
  } catch (error) {
    write("Create mastermind thread failed.", { error: String(error.message || error) });
  }
}

function parseMastermindOptions(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((item) => item.trim());
      return {
        option_key: parts[0] || undefined,
        title: parts[1] || parts[0] || undefined,
        rationale: parts[2] || undefined
      };
    });
}

async function loadMastermindThreads(ctx) {
  const { api, write, writePanel, teamOutput, activeTeamKey } = ctx;
  const teamKey = activeTeamKey();
  const query = teamKey ? `?team_key=${encodeURIComponent(teamKey)}` : "";
  try {
    const result = await api(`/account/governance/mastermind/threads${query}`);
    writePanel(teamOutput, result, "No mastermind threads loaded.");
    write("Mastermind threads loaded.", result);
  } catch (error) {
    write("Load mastermind threads failed.", { error: String(error.message || error) });
  }
}

async function loadMastermindThreadDetail(ctx) {
  const { $, api, write, writePanel, teamOutput } = ctx;
  const threadId = ($("govThreadIdInput")?.value || "").trim();
  if (!threadId) {
    write("Thread ID is required.");
    return;
  }
  try {
    const result = await api(`/account/governance/mastermind/thread/${encodeURIComponent(threadId)}`);
    writePanel(teamOutput, result, "No mastermind thread data loaded.");
    write("Mastermind thread detail loaded.", result);
  } catch (error) {
    write("Load mastermind thread detail failed.", { error: String(error.message || error) });
  }
}

async function addMastermindEntry(ctx) {
  const { $, api, write } = ctx;
  const threadId = ($("govThreadIdInput")?.value || "").trim();
  const message = ($("govEntryMessageInput")?.value || "").trim();
  if (!threadId || !message) {
    write("Thread ID and entry message are required.");
    return;
  }
  try {
    const result = await api("/account/governance/mastermind/entry", "POST", {
      thread_id: threadId,
      entry_type: "suggestion",
      message
    });
    write("Mastermind entry added.", result);
    await loadMastermindThreadDetail(ctx);
  } catch (error) {
    write("Add mastermind entry failed.", { error: String(error.message || error) });
  }
}

async function castMastermindVote(ctx) {
  const { $, api, write } = ctx;
  const threadId = ($("govThreadIdInput")?.value || "").trim();
  const optionKey = ($("govVoteOptionInput")?.value || "").trim();
  if (!threadId || !optionKey) {
    write("Thread ID and option key are required.");
    return;
  }
  try {
    const result = await api("/account/governance/mastermind/vote", "POST", {
      thread_id: threadId,
      option_key: optionKey,
      rationale: ($("govVoteRationaleInput")?.value || "").trim() || undefined
    });
    write("Mastermind vote submitted.", result);
    await loadMastermindThreadDetail(ctx);
  } catch (error) {
    write("Cast mastermind vote failed.", { error: String(error.message || error) });
  }
}

async function finalizeMastermindDecision(ctx) {
  const { $, api, write } = ctx;
  const threadId = ($("govThreadIdInput")?.value || "").trim();
  if (!threadId) {
    write("Thread ID is required.");
    return;
  }
  try {
    const result = await api("/account/governance/mastermind/decide", "POST", {
      thread_id: threadId,
      decision: $("govDecisionSelect")?.value || "approve",
      option_key: ($("govDecisionOptionInput")?.value || "").trim() || undefined,
      note: ($("govDecisionNoteInput")?.value || "").trim() || undefined
    });
    write("Mastermind decision finalized.", result);
    await loadMastermindThreadDetail(ctx);
  } catch (error) {
    write("Finalize mastermind decision failed.", { error: String(error.message || error) });
  }
}

async function pullGovernanceSync(ctx) {
  const { api, write, writePanel, teamOutput } = ctx;
  try {
    const result = await api("/account/governance/sync/pull?since_sequence=0&limit=200");
    writePanel(teamOutput, result, "No governance sync events loaded.");
    write("Governance sync pull loaded.", result);
  } catch (error) {
    write("Governance sync pull failed.", { error: String(error.message || error) });
  }
}
