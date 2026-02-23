(function () {
  "use strict";

  const installKey = "pg_install_id";
  const $ = (id) => document.getElementById(id);

  const state = {
    activeTab: "overview",
    summary: null,
    bearerToken: "",
    adminRoutePrefix: "/pg-global-admin"
  };

  const out = $("consoleOutput");
  const authShell = $("authShell");
  const portalShell = $("portalShell");
  const authState = $("authState");
  const profileEmail = $("profileEmail");
  const profilePlan = $("profilePlan");
  const signOutBtn = $("signOutBtn");
  const teamNavBtn = $("teamNavBtn");
  const adminNavBtn = $("adminNavBtn");

  const accountOutput = $("accountOutput");
  const billingOutput = $("billingOutput");
  const supportOutput = $("supportOutput");
  const teamOutput = $("teamOutput");
  const adminOutput = $("adminOutput");

  function readToken() {
    return state.bearerToken;
  }

  function ensureInstallId() {
    let installId = localStorage.getItem(installKey);
    if (!installId) {
      installId = "web-" + Math.random().toString(36).slice(2, 11);
      localStorage.setItem(installKey, installId);
    }
    return installId;
  }

  function setToken(token) {
    state.bearerToken = token || "";
    updateAuthView();
  }

  function write(line, payload) {
    if (!out) {
      return;
    }
    const stamp = new Date().toISOString();
    const body = payload === undefined ? "" : "\n" + JSON.stringify(payload, null, 2);
    out.textContent = `[${stamp}] ${line}${body}\n\n` + out.textContent;
  }

  function writePanel(panel, payload, fallback) {
    if (!panel) {
      return;
    }
    panel.textContent = payload ? JSON.stringify(payload, null, 2) : fallback;
  }

  function updateAuthView() {
    const signedIn = Boolean(state.summary);
    if (authShell) {
      authShell.classList.toggle("hidden", signedIn);
    }
    if (portalShell) {
      portalShell.classList.toggle("hidden", !signedIn);
    }
    if (signOutBtn) {
      signOutBtn.classList.toggle("hidden", !signedIn);
    }
    if (authState) {
      authState.textContent = signedIn
        ? "Signed in."
        : "Not signed in.";
    }
    if (!signedIn) {
      state.summary = null;
      refreshProfileHeader();
    }
  }

  function refreshProfileHeader() {
    const summary = state.summary;
    if (profileEmail) {
      profileEmail.textContent = summary?.account?.email || "No account loaded";
    }
    if (profilePlan) {
      const label = summary?.plan ? String(summary.plan).toUpperCase() : "-";
      profilePlan.textContent = `Plan: ${label}`;
    }
    if (teamNavBtn) {
      const showTeam = Boolean(summary?.can_manage_team);
      teamNavBtn.classList.toggle("hidden", !showTeam);
      if (!showTeam && state.activeTab === "team") {
        setTab("overview");
      }
    }
    if (adminNavBtn) {
      const showAdmin = Boolean(summary?.can_access_admin_board);
      adminNavBtn.classList.toggle("hidden", !showAdmin);
      if (!showAdmin && state.activeTab === "admin") {
        setTab("overview");
      }
    }
  }

  function adminApiBase() {
    return `${state.adminRoutePrefix}/board`;
  }

  function setTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll(".portal-nav-btn").forEach((btn) => {
      const isActive = btn.getAttribute("data-tab") === tabName;
      btn.classList.toggle("is-active", isActive);
    });
    document.querySelectorAll(".portal-panel").forEach((panel) => {
      const visible = panel.getAttribute("data-panel") === tabName;
      panel.classList.toggle("hidden", !visible);
    });
  }

  function parseList(value) {
    return (value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseBool(value) {
    return String(value).toLowerCase() === "true";
  }

  function activeTeamKey() {
    const manage = ($("teamKeyManageInput")?.value || "").trim().toUpperCase();
    if (manage) {
      return manage;
    }
    const create = ($("teamKeyCreateInput")?.value || "").trim().toUpperCase();
    return create || undefined;
  }

  async function api(path, method = "GET", body, authRequired = true) {
    const headers = { "Content-Type": "application/json" };
    const token = readToken();
    if (token) {
      headers.Authorization = "Bearer " + token;
    }
    if (authRequired) {
      // Cookie-based auth can work without explicit bearer token.
    }
    const response = await fetch(path, {
      method,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined
    });
    const raw = await response.text();
    let json = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = { raw };
    }
    if (!response.ok) {
      const message = typeof json.error === "string" ? json.error : raw;
      if (authRequired && response.status === 401) {
        state.summary = null;
        updateAuthView();
      }
      throw new Error(message || `Request failed (${response.status})`);
    }
    return json;
  }

  async function loadAccountSummary() {
    const result = await api("/account/summary");
    state.summary = result;
    if (typeof result?.admin_route_prefix === "string" && result.admin_route_prefix.trim()) {
      state.adminRoutePrefix = result.admin_route_prefix.trim();
    }
    refreshProfileHeader();
    writePanel(accountOutput, result, "No account data loaded.");
    write("Account summary loaded.", result);
    return result;
  }

  async function sendEmailCode() {
    const email = ($("emailInput")?.value || "").trim();
    if (!email) {
      write("Email is required.");
      return;
    }
    try {
      const result = await api("/auth/email/start", "POST", { email }, false);
      write("Email code issued.", result);
    } catch (error) {
      write("Email code failed.", { error: String(error.message || error) });
    }
  }

  async function verifyEmailCode() {
    const email = ($("emailInput")?.value || "").trim();
    const code = ($("codeInput")?.value || "").trim();
    if (!email || !code) {
      write("Email and verification code are required.");
      return;
    }
    try {
      const result = await api(
        "/auth/email/verify",
        "POST",
        { email, code, install_id: ensureInstallId() },
        false
      );
      if (typeof result.access_token === "string") {
        setToken(result.access_token);
      }
      write("Signed in with email.", result);
      await loadAccountSummary();
    } catch (error) {
      write("Email verification failed.", { error: String(error.message || error) });
    }
  }

  function startOAuth(provider) {
    const callbackUrl = `${window.location.origin}/app`;
    const installId = ensureInstallId();
    const target = `/auth/${provider}/start?install_id=${encodeURIComponent(installId)}&callback_url=${encodeURIComponent(callbackUrl)}`;
    window.location.href = target;
  }

  async function refreshLicenseStatus() {
    try {
      const result = await api("/entitlement/status");
      write("License status refreshed.", result);
    } catch (error) {
      write("License refresh failed.", { error: String(error.message || error) });
    }
  }

  async function startCheckout() {
    try {
      const result = await api("/payments/stripe/create-checkout-session", "POST", {
        plan_id: $("planSelect")?.value,
        module_scope: $("moduleSelect")?.value,
        years: 1,
        affiliate_code: ($("affiliateInput")?.value || "").trim()
      });
      write("Checkout session created.", result);
      if (typeof result.url === "string") {
        window.location.href = result.url;
      }
    } catch (error) {
      write("Checkout start failed.", { error: String(error.message || error) });
    }
  }

  async function createOfflineRef() {
    const email = ($("emailInput")?.value || "").trim() || state.summary?.account?.email || "";
    const amount = Number($("offlineAmountInput")?.value || 0);
    if (!email || !Number.isFinite(amount) || amount <= 0) {
      write("Offline payment requires email and amount.");
      return;
    }
    try {
      const result = await api("/payments/offline/create-ref", "POST", {
        email,
        amount_cents: amount,
        plan_id: $("planSelect")?.value,
        module_scope: $("moduleSelect")?.value,
        years: 1
      });
      if ($("offlineRefInput") && typeof result.ref_code === "string") {
        $("offlineRefInput").value = result.ref_code;
      }
      write("Offline reference created.", result);
    } catch (error) {
      write("Offline reference failed.", { error: String(error.message || error) });
    }
  }

  async function submitOfflineProof() {
    const refCode = ($("offlineRefInput")?.value || "").trim();
    const proofUrl = ($("offlineProofInput")?.value || "").trim();
    if (!refCode || !proofUrl) {
      write("Reference code and proof URL are required.");
      return;
    }
    try {
      const result = await api("/payments/offline/submit-proof", "POST", {
        ref_code: refCode,
        proof_url: proofUrl
      }, false);
      write("Offline proof submitted.", result);
    } catch (error) {
      write("Offline proof submission failed.", { error: String(error.message || error) });
    }
  }

  async function applyRedeemCode() {
    const code = ($("redeemInput")?.value || "").trim().toUpperCase();
    if (!code) {
      write("Redeem code is required.");
      return;
    }
    try {
      const result = await api("/redeem/apply", "POST", { code });
      write("Redeem code applied.", result);
      await loadAccountSummary();
    } catch (error) {
      write("Redeem failed.", { error: String(error.message || error) });
    }
  }

  async function loadBillingHistory() {
    try {
      const result = await api("/account/billing/history");
      writePanel(billingOutput, result, "No billing data loaded.");
      write("Billing history loaded.", result);
    } catch (error) {
      write("Billing history failed.", { error: String(error.message || error) });
    }
  }

  async function requestRefund() {
    const reason = ($("refundReasonInput")?.value || "").trim();
    try {
      const result = await api("/refund/request", "POST", { reason: reason || undefined });
      write("Refund requested.", result);
      await loadBillingHistory();
    } catch (error) {
      write("Refund request failed.", { error: String(error.message || error) });
    }
  }

  async function sendSupportRequest() {
    const subject = ($("supportSubjectInput")?.value || "").trim();
    const message = ($("supportMessageInput")?.value || "").trim();
    if (!subject || !message) {
      write("Support subject and message are required.");
      return;
    }
    try {
      const result = await api("/account/support/request", "POST", {
        category: $("supportCategorySelect")?.value,
        severity: $("supportSeveritySelect")?.value,
        subject,
        message
      });
      write("Support request created.", result);
      await loadSupportHistory();
    } catch (error) {
      write("Support request failed.", { error: String(error.message || error) });
    }
  }

  async function loadSupportHistory() {
    try {
      const result = await api("/account/support/history");
      writePanel(supportOutput, result, "No support data loaded.");
      write("Support history loaded.", result);
    } catch (error) {
      write("Support history failed.", { error: String(error.message || error) });
    }
  }

  async function sendFeedback() {
    try {
      const result = await api("/account/feedback", "POST", {
        rating: Number($("feedbackRatingSelect")?.value || 5),
        message: ($("feedbackMessageInput")?.value || "").trim()
      });
      write("Feedback submitted.", result);
    } catch (error) {
      write("Feedback submission failed.", { error: String(error.message || error) });
    }
  }

  async function createTeam() {
    try {
      const result = await api("/account/team/create", "POST", {
        team_key: ($("teamKeyCreateInput")?.value || "").trim().toUpperCase(),
        plan_id: $("teamPlanSelect")?.value,
        module_scope: $("teamModuleSelect")?.value,
        seat_limit: Number($("teamSeatLimitInput")?.value || 5),
        years: Number($("teamYearsInput")?.value || 1)
      });
      if (typeof result.team_key === "string") {
        if ($("teamKeyCreateInput")) {
          $("teamKeyCreateInput").value = result.team_key;
        }
        if ($("teamKeyManageInput")) {
          $("teamKeyManageInput").value = result.team_key;
        }
      }
      write("Team created.", result);
      await loadTeamStatus();
      await loadAccountSummary();
    } catch (error) {
      write("Team creation failed.", { error: String(error.message || error) });
    }
  }

  async function loadTeamStatus() {
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

  async function assignTeamSeat() {
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
      await loadTeamStatus();
    } catch (error) {
      write("Assign seat failed.", { error: String(error.message || error) });
    }
  }

  async function revokeTeamSeat() {
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
      await loadTeamStatus();
    } catch (error) {
      write("Revoke seat failed.", { error: String(error.message || error) });
    }
  }

  async function applyTeamPolicy() {
    try {
      const result = await api("/account/team/provider-policy/set", "POST", {
        team_key: activeTeamKey(),
        local_only: parseBool($("policyLocalOnlySelect")?.value),
        byo_allowed: parseBool($("policyByoAllowedSelect")?.value),
        allowlist: parseList($("policyAllowlistInput")?.value),
        denylist: parseList($("policyDenylistInput")?.value)
      });
      write("Team provider policy applied.", result);
      await loadTeamStatus();
    } catch (error) {
      write("Team policy update failed.", { error: String(error.message || error) });
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

  async function loadGovernanceSettings() {
    const teamKey = activeTeamKey();
    const query = teamKey ? `?team_key=${encodeURIComponent(teamKey)}` : "";
    try {
      const result = await api(`/account/governance/settings${query}`);
      if (result?.settings) {
        if ($("govSlackEnabledSelect")) {
          $("govSlackEnabledSelect").value = result.settings.slack_enabled ? "true" : "false";
        }
        if ($("govSlackChannelInput")) {
          $("govSlackChannelInput").value = result.settings.slack_channel || "";
        }
        if ($("govVoteModeSelect")) {
          $("govVoteModeSelect").value = result.settings.vote_mode || "majority";
        }
        if ($("govRetentionDaysInput")) {
          $("govRetentionDaysInput").value = String(result.settings.retention_days || 7);
        }
        if ($("govMaxCharsInput")) {
          $("govMaxCharsInput").value = String(result.settings.max_debate_chars || 4000);
        }
      }
      writePanel(teamOutput, result, "No governance settings loaded.");
      write("Governance settings loaded.", result);
    } catch (error) {
      write("Load governance settings failed.", { error: String(error.message || error) });
    }
  }

  async function saveGovernanceSettings() {
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

  async function sendGovernanceSlackTest() {
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

  async function submitEodReport() {
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
      await loadEodReports();
    } catch (error) {
      write("EOD submit failed.", { error: String(error.message || error) });
    }
  }

  async function loadEodReports() {
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

  async function createMastermindThread() {
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
      await loadMastermindThreads();
    } catch (error) {
      write("Create mastermind thread failed.", { error: String(error.message || error) });
    }
  }

  async function loadMastermindThreads() {
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

  async function loadMastermindThreadDetail() {
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

  async function addMastermindEntry() {
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
      await loadMastermindThreadDetail();
    } catch (error) {
      write("Add mastermind entry failed.", { error: String(error.message || error) });
    }
  }

  async function castMastermindVote() {
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
      await loadMastermindThreadDetail();
    } catch (error) {
      write("Cast mastermind vote failed.", { error: String(error.message || error) });
    }
  }

  async function finalizeMastermindDecision() {
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
      await loadMastermindThreadDetail();
    } catch (error) {
      write("Finalize mastermind decision failed.", { error: String(error.message || error) });
    }
  }

  async function pullGovernanceSync() {
    try {
      const result = await api("/account/governance/sync/pull?since_sequence=0&limit=200");
      writePanel(teamOutput, result, "No governance sync events loaded.");
      write("Governance sync pull loaded.", result);
    } catch (error) {
      write("Governance sync pull failed.", { error: String(error.message || error) });
    }
  }

  async function loadAdminSummary() {
    const result = await api(`${adminApiBase()}/summary`);
    writePanel(adminOutput, result, "No admin data loaded.");
    write("Admin summary loaded.", result);
  }

  async function loadAdminUsers() {
    const result = await api(`${adminApiBase()}/users?limit=200`);
    writePanel(adminOutput, result, "No admin data loaded.");
    write("Admin users loaded.", result);
  }

  async function loadAdminSubscriptions() {
    const result = await api(`${adminApiBase()}/subscriptions?limit=200`);
    writePanel(adminOutput, result, "No admin data loaded.");
    write("Admin subscriptions loaded.", result);
  }

  async function loadAdminPayments() {
    const result = await api(`${adminApiBase()}/payments`);
    writePanel(adminOutput, result, "No admin data loaded.");
    write("Admin payments loaded.", result);
  }

  async function loadAdminSupportQueue() {
    const result = await api(`${adminApiBase()}/support?limit=200`);
    writePanel(adminOutput, result, "No admin data loaded.");
    write("Admin support queue loaded.", result);
  }

  async function loadAdminGovernance() {
    const result = await api(`${adminApiBase()}/governance`);
    writePanel(adminOutput, result, "No governance admin data loaded.");
    write("Admin governance loaded.", result);
  }

  async function updateTicketStatus() {
    const ticketId = ($("adminTicketIdInput")?.value || "").trim();
    const status = $("adminTicketStatusSelect")?.value;
    if (!ticketId || !status) {
      write("Ticket ID and status are required.");
      return;
    }
    const result = await api(`${adminApiBase()}/support/status`, "POST", {
      ticket_id: ticketId,
      status,
      resolution_note: ($("adminTicketNoteInput")?.value || "").trim()
    });
    write("Admin ticket updated.", result);
    await loadAdminSupportQueue();
  }

  async function revokeSubscription() {
    const subscriptionId = ($("adminSubscriptionIdInput")?.value || "").trim();
    if (!subscriptionId) {
      write("Subscription ID is required.");
      return;
    }
    const result = await api(`${adminApiBase()}/subscription/revoke`, "POST", {
      subscription_id: subscriptionId
    });
    write("Subscription revoked.", result);
    await loadAdminSubscriptions();
  }

  async function revokeUserSessions() {
    const userId = ($("adminUserIdInput")?.value || "").trim();
    if (!userId) {
      write("User ID is required.");
      return;
    }
    const result = await api(`${adminApiBase()}/sessions/revoke-user`, "POST", {
      user_id: userId
    });
    write("User sessions revoked.", result);
  }

  async function setTeamSlackAddon() {
    const teamKey = ($("adminGovernanceTeamKeyInput")?.value || "").trim().toUpperCase();
    if (!teamKey) {
      write("Team key is required.");
      return;
    }
    const active = parseBool($("adminGovernanceAddonActiveSelect")?.value);
    const result = await api(`${state.adminRoutePrefix}/governance/slack-addon/team`, "POST", {
      team_key: teamKey,
      active
    });
    write("Team slack add-on updated.", result);
    await loadAdminGovernance();
  }

  async function setUserSlackAddon() {
    const email = ($("adminGovernanceEmailInput")?.value || "").trim();
    if (!email) {
      write("User email is required.");
      return;
    }
    const active = parseBool($("adminGovernanceAddonActiveSelect")?.value);
    const result = await api(`${state.adminRoutePrefix}/governance/slack-addon/user`, "POST", {
      email,
      active
    });
    write("User slack add-on updated.", result);
    await loadAdminGovernance();
  }

  function readOAuthQuery() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("access_token");
    const status = params.get("status");
    if (token) {
      setToken(token);
      write("OAuth token captured.");
    }
    if (status) {
      write("OAuth status", {
        status,
        message: params.get("message"),
        user_id: params.get("user_id")
      });
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, "", cleanUrl);
    }
  }

  function signOut() {
    api("/auth/session/signout", "POST", undefined, false)
      .catch(() => undefined)
      .finally(() => {
        setToken("");
        state.summary = null;
        updateAuthView();
        write("Signed out.");
      });
  }

  async function restoreSession() {
    try {
      await loadAccountSummary();
    } catch {
      setToken("");
      state.summary = null;
      updateAuthView();
      write("No active session.");
    }
  }

  function bindClick(id, handler) {
    const el = $(id);
    if (el) {
      el.addEventListener("click", async () => {
        try {
          await handler();
        } catch (error) {
          write("Action failed.", { error: String(error.message || error) });
        }
      });
    }
  }

  ensureInstallId();
  readOAuthQuery();
  updateAuthView();

  document.querySelectorAll(".portal-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (tab) {
        setTab(tab);
      }
    });
  });
  setTab("overview");

  bindClick("sendCodeBtn", sendEmailCode);
  bindClick("verifyCodeBtn", verifyEmailCode);
  bindClick("githubSignInBtn", async () => startOAuth("github"));
  bindClick("googleSignInBtn", async () => startOAuth("google"));
  bindClick("signOutBtn", async () => {
    signOut();
  });

  bindClick("accountSummaryBtn", loadAccountSummary);
  bindClick("statusBtn", refreshLicenseStatus);
  bindClick("checkoutBtn", startCheckout);
  bindClick("createOfflineBtn", createOfflineRef);
  bindClick("submitProofBtn", submitOfflineProof);
  bindClick("redeemBtn", applyRedeemCode);
  bindClick("billingHistoryBtn", loadBillingHistory);
  bindClick("refundRequestBtn", requestRefund);

  bindClick("supportHistoryBtn", loadSupportHistory);
  bindClick("supportRequestBtn", sendSupportRequest);
  bindClick("feedbackSubmitBtn", sendFeedback);

  bindClick("teamCreateBtn", createTeam);
  bindClick("teamStatusBtn", loadTeamStatus);
  bindClick("teamAssignBtn", assignTeamSeat);
  bindClick("teamRevokeBtn", revokeTeamSeat);
  bindClick("teamPolicyBtn", applyTeamPolicy);
  bindClick("govSettingsLoadBtn", loadGovernanceSettings);
  bindClick("govSettingsSaveBtn", saveGovernanceSettings);
  bindClick("govSlackTestBtn", sendGovernanceSlackTest);
  bindClick("govEodCreateBtn", submitEodReport);
  bindClick("govEodListBtn", loadEodReports);
  bindClick("govThreadCreateBtn", createMastermindThread);
  bindClick("govThreadListBtn", loadMastermindThreads);
  bindClick("govThreadLoadBtn", loadMastermindThreadDetail);
  bindClick("govThreadEntryBtn", addMastermindEntry);
  bindClick("govThreadVoteBtn", castMastermindVote);
  bindClick("govThreadDecideBtn", finalizeMastermindDecision);
  bindClick("govSyncPullBtn", pullGovernanceSync);

  bindClick("adminSummaryBtn", loadAdminSummary);
  bindClick("adminUsersBtn", loadAdminUsers);
  bindClick("adminSubscriptionsBtn", loadAdminSubscriptions);
  bindClick("adminPaymentsBtn", loadAdminPayments);
  bindClick("adminSupportBtn", loadAdminSupportQueue);
  bindClick("adminGovernanceBtn", loadAdminGovernance);
  bindClick("adminTicketUpdateBtn", updateTicketStatus);
  bindClick("adminRevokeSubscriptionBtn", revokeSubscription);
  bindClick("adminRevokeSessionsBtn", revokeUserSessions);
  bindClick("adminGovernanceTeamAddonBtn", setTeamSlackAddon);
  bindClick("adminGovernanceUserAddonBtn", setUserSlackAddon);

  restoreSession();
})();
