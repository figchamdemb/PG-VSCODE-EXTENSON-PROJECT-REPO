import { createTeamGovernanceOps } from "./site.teamGovernanceOps.js";
import { createAdminOps } from "./site.adminOps.js";
import { applyPortalLaunchContext } from "./site.portalLaunchContext.js";
import { initializeAuthCards } from "./site.authCards.js";
import { createTapSignEnrollmentHelpers } from "./site.tapSignEnrollment.js";
import {
  DEFAULT_PUBLIC_PRICING_CATALOG,
  getSkuEntry,
  loadPublicPricingCatalog,
  priceText
} from "./pricingCatalogClient.js";
const installKey = "pg_install_id";
const $ = (id) => document.getElementById(id);
const state = {
  activeTab: "overview",
  summary: null,
  bearerToken: "",
  adminRoutePrefix: "/pg-global-admin",
  pricingCatalog: DEFAULT_PUBLIC_PRICING_CATALOG
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
    authState.textContent = signedIn ? "Signed in." : "Not signed in.";
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
  tapSignEnrollment.refresh(summary);
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
function getAnnualSkuGuide(planId, moduleScope) {
  return planId && moduleScope ? getSkuEntry(state.pricingCatalog, planId, moduleScope) : null;
}
function refreshBillingSkuHint() {
  const hint = $("billingSkuHint");
  const offlineAmountInput = $("offlineAmountInput");
  const planId = $("planSelect")?.value || "";
  const moduleScope = $("moduleSelect")?.value || "";
  const sku = getAnnualSkuGuide(planId, moduleScope);
  if (hint) {
    if (!sku) {
      hint.textContent = "Select a plan and module to see the recommended annual SKU.";
    } else {
      hint.textContent =
        `${sku.label} (${planId}:${moduleScope}) -> recommended ${priceText(sku)} ` +
        `annual one-time checkout. ${sku.note} ${sku.seat_hint}`;
    }
  }
  if (offlineAmountInput && sku && document.activeElement !== offlineAmountInput) {
    offlineAmountInput.value = String(sku.minor_units);
  }
}
async function loadPricingCatalogIntoState() {
  state.pricingCatalog = await loadPublicPricingCatalog();
  refreshBillingSkuHint();
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
  updateAuthView();
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
  if (!refCode) {
    write("Reference code is required.");
    return;
  }
  try {
    const result = await api(
      "/payments/offline/submit-proof",
      "POST",
      { ref_code: refCode },
      false
    );
    write("Offline payment marked for manual review.", result);
  } catch (error) {
    write("Offline payment review request failed.", { error: String(error.message || error) });
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
  if (!el) {
    return;
  }
  el.addEventListener("click", async () => {
    try {
      await handler();
    } catch (error) {
      write("Action failed.", { error: String(error.message || error) });
    }
  });
}
function bindChange(id, handler) {
  const el = $(id);
  if (!el) {
    return;
  }
  el.addEventListener("change", handler);
}
const portalContext = {
  $, state, teamOutput, adminOutput, api, write, writePanel, parseList, parseBool,
  activeTeamKey, loadAccountSummary, adminApiBase
};
const teamGovernanceOps = createTeamGovernanceOps(portalContext);
const adminOps = createAdminOps(portalContext);
const tapSignEnrollment = createTapSignEnrollmentHelpers({ $, write, setTab });
ensureInstallId();
readOAuthQuery();
updateAuthView();
initializeAuthCards($, write);
document.querySelectorAll(".portal-nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.getAttribute("data-tab");
    if (tab) {
      setTab(tab);
    }
  });
});
setTab("overview");
[
  ["tapSignSignupBtn", tapSignEnrollment.startSignup],
  ["sendCodeBtn", sendEmailCode], ["verifyCodeBtn", verifyEmailCode],
  ["githubSignInBtn", async () => startOAuth("github")], ["googleSignInBtn", async () => startOAuth("google")],
  ["signOutBtn", async () => signOut()], ["accountSummaryBtn", loadAccountSummary],
  ["tapSignSetupBtn", tapSignEnrollment.startProtection],
  ["statusBtn", refreshLicenseStatus], ["checkoutBtn", startCheckout],
  ["createOfflineBtn", createOfflineRef], ["submitProofBtn", submitOfflineProof],
  ["redeemBtn", applyRedeemCode], ["billingHistoryBtn", loadBillingHistory],
  ["refundRequestBtn", requestRefund], ["supportHistoryBtn", loadSupportHistory],
  ["supportRequestBtn", sendSupportRequest], ["feedbackSubmitBtn", sendFeedback],
  ["teamCreateBtn", teamGovernanceOps.createTeam], ["teamStatusBtn", teamGovernanceOps.loadTeamStatus],
  ["teamAssignBtn", teamGovernanceOps.assignTeamSeat], ["teamRevokeBtn", teamGovernanceOps.revokeTeamSeat],
  ["teamPolicyBtn", teamGovernanceOps.applyTeamPolicy], ["govSettingsLoadBtn", teamGovernanceOps.loadGovernanceSettings],
  ["govSettingsSaveBtn", teamGovernanceOps.saveGovernanceSettings], ["govSlackTestBtn", teamGovernanceOps.sendGovernanceSlackTest],
  ["govEodCreateBtn", teamGovernanceOps.submitEodReport], ["govEodListBtn", teamGovernanceOps.loadEodReports],
  ["govThreadCreateBtn", teamGovernanceOps.createMastermindThread], ["govThreadListBtn", teamGovernanceOps.loadMastermindThreads],
  ["govThreadLoadBtn", teamGovernanceOps.loadMastermindThreadDetail], ["govThreadEntryBtn", teamGovernanceOps.addMastermindEntry],
  ["govThreadVoteBtn", teamGovernanceOps.castMastermindVote], ["govThreadDecideBtn", teamGovernanceOps.finalizeMastermindDecision],
  ["govSyncPullBtn", teamGovernanceOps.pullGovernanceSync], ["adminSummaryBtn", adminOps.loadAdminSummary],
  ["adminUsersBtn", adminOps.loadAdminUsers], ["adminSubscriptionsBtn", adminOps.loadAdminSubscriptions],
  ["adminPaymentsBtn", adminOps.loadAdminPayments], ["adminSupportBtn", adminOps.loadAdminSupportQueue],
  ["adminGovernanceBtn", adminOps.loadAdminGovernance], ["adminTicketUpdateBtn", adminOps.updateTicketStatus],
  ["adminRevokeSubscriptionBtn", adminOps.revokeSubscription], ["adminRevokeSessionsBtn", adminOps.revokeUserSessions],
  ["adminGovernanceTeamAddonBtn", adminOps.setTeamSlackAddon], ["adminGovernanceUserAddonBtn", adminOps.setUserSlackAddon],
  ["adminStripeConfigLoadBtn", adminOps.loadAdminStripeConfig], ["adminStripeConfigSaveBtn", adminOps.saveAdminStripeConfig],
  ["adminStripeConfigTestBtn", adminOps.testAdminStripeConfig], ["adminPricingCatalogResetBtn", adminOps.resetAdminPricingCatalog],
  ["adminPricingCatalogSyncBtn", adminOps.syncAdminPricingCatalog], ["adminPricingCatalogApplyJsonBtn", adminOps.applyAdminPricingCatalogJson]
].forEach(([id, handler]) => bindClick(id, handler));
bindChange("planSelect", refreshBillingSkuHint);
bindChange("moduleSelect", refreshBillingSkuHint);
refreshBillingSkuHint();
loadPricingCatalogIntoState();
applyPortalLaunchContext({ $, setTab, refreshBillingSkuHint });
restoreSession();
