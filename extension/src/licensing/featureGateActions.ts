import * as vscode from "vscode";
import { Logger } from "../utils/logger";
import { EntitlementClient } from "./entitlementClient";
import { LicensingCallbackHandler } from "./licensingCallbackHandler";
import { buildCurrentWorkspaceFingerprint } from "./projectQuota";
import { LicensingSecretStorage } from "./secretStorage";
import { EntitlementClaims } from "./types";

type CheckoutPlan = "pro" | "team" | "enterprise";
type CheckoutModule = "narrate" | "memorybank" | "bundle";

type CheckoutSelection = {
  plan: CheckoutPlan;
  module: CheckoutModule;
  years: number;
  affiliateCode?: string;
};

type RefreshSource = "startup" | "manual" | "signin" | "trial-start";

export interface FeatureGateActionContext {
  logger: Logger;
  storage: LicensingSecretStorage;
  callbackHandler: LicensingCallbackHandler;
  getApiBaseUrl: () => string;
  getClient: () => EntitlementClient;
  refreshLicense: (source: RefreshSource) => Promise<void>;
}

interface DevicePickItem extends vscode.QuickPickItem {
  id: string;
  installId: string;
  isCurrent: boolean;
}

export async function runSignInWithEmail(context: FeatureGateActionContext): Promise<void> {
  const email = await vscode.window.showInputBox({
    title: "Narrate Licensing: Sign In",
    prompt: "Enter account email",
    placeHolder: "name@company.com",
    ignoreFocusOut: true
  });
  if (!email?.trim()) {
    return;
  }

  const installId = await context.storage.getOrCreateInstallId();
  const client = context.getClient();
  const started = await client.startEmailAuth(email.trim());
  const promptText = started.dev_code
    ? `Enter code sent to email (dev code: ${started.dev_code})`
    : "Enter code sent to email";

  const code = await vscode.window.showInputBox({
    title: "Narrate Licensing: Verify Email",
    prompt: promptText,
    ignoreFocusOut: true
  });
  if (!code?.trim()) {
    return;
  }

  const verified = await client.verifyEmailAuth(email.trim(), code.trim(), installId);
  await context.storage.setAccessToken(verified.access_token);
  await context.refreshLicense("signin");
  vscode.window.showInformationMessage("Narrate: signed in and license refreshed.");
}

export async function runSignInWithGitHub(context: FeatureGateActionContext): Promise<void> {
  const installId = await context.storage.getOrCreateInstallId();
  const { accessToken, userId } = await waitForGitHubCallback(context, installId);
  if (!accessToken) {
    return;
  }

  vscode.window.showInformationMessage(
    `Narrate: signed in with GitHub${userId ? ` (user ${userId})` : ""} and license refreshed.`
  );
}

export async function runStartTrial(context: FeatureGateActionContext): Promise<void> {
  const accessToken = await context.storage.getAccessToken();
  if (!accessToken) {
    vscode.window.showWarningMessage("Narrate: sign in first to start trial.");
    return;
  }
  const result = await context.getClient().startTrial(accessToken);
  await context.refreshLicense("trial-start");
  vscode.window.showInformationMessage(
    `Narrate: trial started. Expires at ${result.trial_expires_at}.`
  );
}

export async function runRedeemCode(context: FeatureGateActionContext): Promise<void> {
  const accessToken = await context.storage.getAccessToken();
  if (!accessToken) {
    vscode.window.showWarningMessage("Narrate: sign in first to redeem a code.");
    return;
  }

  const code = await vscode.window.showInputBox({
    title: "Narrate Licensing: Redeem Code",
    prompt: "Enter redeem code",
    placeHolder: "NAR-XXXX-XXXX-XXXX",
    ignoreFocusOut: true
  });
  if (!code?.trim()) {
    return;
  }

  const result = await context.getClient().redeemCode(accessToken, code.trim());
  await context.refreshLicense("manual");
  vscode.window.showInformationMessage(
    `Narrate: redeem applied (${result.plan_id.toUpperCase()} / ${result.module_scope}). Expires at ${result.ends_at}.`
  );
}

export async function runOpenUpgradeCheckout(context: FeatureGateActionContext): Promise<void> {
  const accessToken = await ensureCheckoutAccessToken(context);
  if (!accessToken) {
    return;
  }

  const selection = await collectCheckoutSelection();
  if (!selection) {
    return;
  }
  await openCheckoutSession(context, accessToken, selection);
}

export async function runManageDevices(context: FeatureGateActionContext): Promise<void> {
  const accessToken = await context.storage.getAccessToken();
  if (!accessToken) {
    vscode.window.showWarningMessage("Narrate: sign in first to manage devices.");
    return;
  }

  const picked = await pickDeviceToRevoke(context, accessToken);
  if (!picked) {
    return;
  }
  if (picked.isCurrent) {
    vscode.window.showWarningMessage(
      "Narrate: current device cannot be revoked from this installation."
    );
    return;
  }

  if (!(await confirmDeviceRevocation(picked.label))) {
    return;
  }

  await context.getClient().revokeDevice(accessToken, picked.id);
  vscode.window.showInformationMessage(`Narrate: revoked device ${picked.label}.`);
}

export async function runShowLicenseStatus(
  context: FeatureGateActionContext,
  mode: "backend" | "placeholder",
  plan: string,
  claims: EntitlementClaims | undefined
): Promise<void> {
  const expiry = claims ? new Date(claims.exp * 1000).toISOString() : "n/a";
  const installId = await context.storage.getOrCreateInstallId();
  const lines = [`Mode: ${mode}`, `Plan: ${plan}`, `Install ID: ${installId}`, `Token expires at: ${expiry}`];

  if (claims) {
    lines.push(
      `Features: edu_view=${claims.features.edu_view}, export=${claims.features.export}, change_report=${claims.features.change_report}, memorybank=${claims.features.memorybank}`
    );
    lines.push(`Project quota: used=${claims.projects_used} / allowed=${claims.projects_allowed}`);
  }

  vscode.window.showInformationMessage(`Narrate licensing\n${lines.join("\n")}`);
}

export async function runActivateCurrentWorkspaceProject(
  context: FeatureGateActionContext
): Promise<void> {
  const accessToken = await context.storage.getAccessToken();
  if (!accessToken) {
    vscode.window.showWarningMessage("Narrate: sign in first to activate a project.");
    return;
  }

  const fingerprint = buildCurrentWorkspaceFingerprint();
  if (!fingerprint) {
    vscode.window.showWarningMessage("Narrate: open a workspace folder first.");
    return;
  }

  const result = await context.getClient().activateProject(
    accessToken,
    fingerprint.scope,
    fingerprint.repoFingerprint,
    fingerprint.repoLabel
  );

  vscode.window.showInformationMessage(
    `Narrate: project activation ${result.idempotent ? "already exists" : "created"} (${result.projects_used}/${result.projects_allowed}).`
  );
  await context.refreshLicense("manual");
}

export async function runShowProjectQuota(context: FeatureGateActionContext): Promise<void> {
  const accessToken = await context.storage.getAccessToken();
  if (!accessToken) {
    vscode.window.showWarningMessage("Narrate: sign in first to view quota.");
    return;
  }

  const quota = await context.getClient().getProjectQuota(accessToken, "memorybank");
  vscode.window.showInformationMessage(
    `Narrate quota (memorybank): used=${quota.projects_used}, allowed=${quota.projects_allowed}, remaining=${quota.projects_remaining}`
  );
}

export function evaluateProviderAccess(
  policy: EntitlementClaims["provider_policy"] | undefined,
  baseUrl: string
): { allowed: boolean; reason?: string } {
  if (!policy) {
    return { allowed: true };
  }

  let host = "";
  try {
    host = new URL(baseUrl).host.toLowerCase();
  } catch {
    return { allowed: false, reason: "Invalid provider URL." };
  }

  if (policy.local_only && !isLocalHost(host)) {
    return { allowed: false, reason: "Organization policy requires local-only providers." };
  }

  if (policy.denylist.some((entry) => host.includes(entry.toLowerCase()))) {
    return { allowed: false, reason: `Provider host ${host} is blocked by policy.` };
  }

  if (policy.allowlist.length > 0) {
    const matchesAllow = policy.allowlist.some((entry) => host.includes(entry.toLowerCase()));
    if (!matchesAllow) {
      return { allowed: false, reason: `Provider host ${host} is not in the policy allowlist.` };
    }
  }

  if (!policy.byo_allowed && !policy.local_only && policy.allowlist.length === 0) {
    return { allowed: false, reason: "Organization policy disables BYO provider endpoints." };
  }

  return { allowed: true };
}

async function waitForGitHubCallback(
  context: FeatureGateActionContext,
  installId: string
): Promise<{ accessToken?: string; userId?: string }> {
  const timeoutMs = 5 * 60 * 1000;
  const callbackUrl = context.callbackHandler.createAuthCallbackUrl();
  const startUrl = new URL("/auth/github/start", context.getApiBaseUrl());
  startUrl.searchParams.set("install_id", installId);
  startUrl.searchParams.set("callback_url", callbackUrl);
  const resultPromise = context.callbackHandler.waitForAuthCallback(timeoutMs);

  try {
    const opened = await vscode.env.openExternal(vscode.Uri.parse(startUrl.toString()));
    if (!opened) {
      context.callbackHandler.abortPendingAuth("Unable to open the GitHub sign-in page in your browser.");
      throw new Error("Unable to open the GitHub sign-in page in your browser.");
    }
    return await resultPromise;
  } catch (error) {
    if (!(error instanceof Error && /pendingAuthRequest/.test(error.message))) {
      context.callbackHandler.abortPendingAuth(
        error instanceof Error ? error.message : String(error)
      );
    }
    throw error;
  }
}

async function ensureCheckoutAccessToken(
  context: FeatureGateActionContext
): Promise<string | undefined> {
  const accessToken = await context.storage.getAccessToken();
  if (accessToken) {
    return accessToken;
  }
  const action = await vscode.window.showWarningMessage(
    "Narrate: sign in first to start checkout.",
    "Sign In",
    "Cancel"
  );
  if (action !== "Sign In") {
    return undefined;
  }
  await runSignInWithEmail(context);
  return context.storage.getAccessToken();
}

async function collectCheckoutSelection(): Promise<CheckoutSelection | undefined> {
  const plan = await pickCheckoutPlan();
  if (!plan) {
    return undefined;
  }
  const module = await pickCheckoutModule();
  if (!module) {
    return undefined;
  }
  const years = await pickCheckoutYears();
  if (years === undefined) {
    return undefined;
  }
  const affiliateCode = await pickCheckoutAffiliateCode();
  return { plan, module, years, affiliateCode };
}

async function pickCheckoutPlan(): Promise<CheckoutPlan | undefined> {
  const picked = await vscode.window.showQuickPick<{ label: string; value: CheckoutPlan }>(
    [
      { label: "Pro", value: "pro" },
      { label: "Team", value: "team" },
      { label: "Enterprise", value: "enterprise" }
    ],
    { title: "Narrate Checkout: Select Plan" }
  );
  return picked?.value;
}

async function pickCheckoutModule(): Promise<CheckoutModule | undefined> {
  const picked = await vscode.window.showQuickPick<{ label: string; value: CheckoutModule }>(
    [
      { label: "Narrate", value: "narrate" },
      { label: "Memory Bank", value: "memorybank" },
      { label: "Bundle (Narrate + Memory Bank)", value: "bundle" }
    ],
    { title: "Narrate Checkout: Select Module" }
  );
  return picked?.value;
}

async function pickCheckoutYears(): Promise<number | undefined> {
  const yearsRaw = await vscode.window.showInputBox({
    title: "Narrate Checkout: Duration (years)",
    prompt: "Enter number of years",
    value: "1",
    ignoreFocusOut: true
  });
  if (!yearsRaw?.trim()) {
    return undefined;
  }
  return Math.max(1, Math.min(5, Number.parseInt(yearsRaw.trim(), 10) || 1));
}

async function pickCheckoutAffiliateCode(): Promise<string | undefined> {
  const affiliateCode = await vscode.window.showInputBox({
    title: "Narrate Checkout: Affiliate Code (optional)",
    prompt: "Leave empty if not using an affiliate code",
    ignoreFocusOut: true
  });
  return affiliateCode?.trim() || undefined;
}

async function openCheckoutSession(
  context: FeatureGateActionContext,
  accessToken: string,
  selection: CheckoutSelection
): Promise<void> {
  const returnUrls = context.callbackHandler.createCheckoutReturnUrls();
  const session = await context.getClient().createStripeCheckoutSession(
    accessToken,
    selection.plan,
    selection.module,
    selection.years,
    selection.affiliateCode,
    returnUrls.successUrl,
    returnUrls.cancelUrl
  );
  await vscode.env.openExternal(vscode.Uri.parse(session.url));
  vscode.window.showInformationMessage(
    "Narrate: checkout opened in your browser. After payment, Narrate will try to return here and refresh the license."
  );
}

async function pickDeviceToRevoke(
  context: FeatureGateActionContext,
  accessToken: string
): Promise<DevicePickItem | undefined> {
  const installId = await context.storage.getOrCreateInstallId();
  const devices = (await context.getClient().listDevices(accessToken)).devices;
  const activeDevices = devices.filter((item) => item.revoked_at === null);
  if (activeDevices.length === 0) {
    vscode.window.showInformationMessage("Narrate: no active devices found.");
    return undefined;
  }
  return vscode.window.showQuickPick<DevicePickItem>(
    activeDevices.map((device) => toDevicePickItem(device, installId)),
    {
      title: "Narrate Licensing: Manage Devices",
      placeHolder: "Select a device to revoke"
    }
  );
}

function toDevicePickItem(
  device: { id: string; install_id: string; device_label?: string | null; last_seen_at: string },
  installId: string
): DevicePickItem {
  const isCurrent = device.install_id === installId;
  const label = `${device.device_label || "Unnamed device"}${isCurrent ? " (current)" : ""}`;
  return {
    label,
    description: device.install_id,
    detail: `Last seen: ${device.last_seen_at}`,
    id: device.id,
    installId: device.install_id,
    isCurrent
  };
}

async function confirmDeviceRevocation(label: string): Promise<boolean> {
  const confirmed = await vscode.window.showWarningMessage(
    `Revoke device ${label}?`,
    "Revoke",
    "Cancel"
  );
  return confirmed === "Revoke";
}

function isLocalHost(host: string): boolean {
  return host.startsWith("127.0.0.1") || host.startsWith("localhost") || host.startsWith("[::1]");
}
