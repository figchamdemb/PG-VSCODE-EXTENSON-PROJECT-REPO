import * as vscode from "vscode";
import { AddressInfo } from "net";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { Logger } from "../utils/logger";
import { formatPlanLabel, isProOrHigher, normalizePlan, PlanTier } from "./plans";
import { EntitlementClient } from "./entitlementClient";
import { buildCurrentWorkspaceFingerprint } from "./projectQuota";
import { LicensingSecretStorage } from "./secretStorage";
import { EntitlementTokenVerifier } from "./tokenVerifier";
import { EntitlementClaims } from "./types";

export class FeatureGateService {
  private readonly storage: LicensingSecretStorage;
  private readonly verifier = new EntitlementTokenVerifier();
  private readonly changedEmitter = new vscode.EventEmitter<void>();
  private entitlementClaims: EntitlementClaims | undefined;
  private initialized = false;

  constructor(
    private readonly logger: Logger,
    private readonly context: vscode.ExtensionContext
  ) {
    this.storage = new LicensingSecretStorage(context);
  }

  get onDidChangeStatus(): vscode.Event<void> {
    return this.changedEmitter.event;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (!this.isBackendMode()) {
      return;
    }

    const autoRefresh = vscode.workspace
      .getConfiguration("narrate.licensing")
      .get<boolean>("autoRefreshOnStartup", true);

    if (!autoRefresh) {
      await this.loadCachedTokenOnly();
      return;
    }

    try {
      await this.refreshLicense("startup");
    } catch (error) {
      this.logger.warn(`Licensing startup refresh skipped: ${toErrorMessage(error)}`);
      await this.loadCachedTokenOnly();
    }
  }

  getCurrentPlan(): PlanTier {
    if (this.isBackendMode() && this.entitlementClaims) {
      return normalizePlan(this.entitlementClaims.plan);
    }
    const config = vscode.workspace.getConfiguration("narrate.licensing");
    return normalizePlan(config.get<string>("placeholderPlan", "free"));
  }

  getPlanLabel(): string {
    return formatPlanLabel(this.getCurrentPlan());
  }

  canUseProFeatures(): boolean {
    const plan = this.getCurrentPlan();
    return isProOrHigher(plan);
  }

  async requireProFeature(featureName: string): Promise<boolean> {
    await this.initialize();

    if (this.isBackendMode()) {
      const featureKey = inferFeatureKey(featureName);
      const allowed = await this.canUseBackendFeature(featureKey);
      if (allowed) {
        return true;
      }

      const plan = this.getCurrentPlan();
      const message = `Narrate: ${featureName} requires Pro/Team/Enterprise. Current plan: ${plan.toUpperCase()}.`;
      this.logger.warn(message);
      const action = await vscode.window.showWarningMessage(
        message,
        "Refresh License",
        "Start Trial",
        "Sign In",
        "Upgrade Plan",
        "Open Settings",
        "Cancel"
      );
      if (action === "Refresh License") {
        await this.refreshLicense("manual");
      } else if (action === "Start Trial") {
        await this.startTrial();
      } else if (action === "Sign In") {
        await this.signInWithEmail();
      } else if (action === "Upgrade Plan") {
        await this.openUpgradeCheckout();
      } else if (action === "Open Settings") {
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "narrate.licensing.mode"
        );
      }
      return false;
    }

    if (this.canUseProFeatures()) {
      return true;
    }

    const plan = this.getCurrentPlan();
    const message = `Narrate: ${featureName} requires Pro/Team/Enterprise. Current placeholder plan: ${plan.toUpperCase()}.`;
    this.logger.warn(message);
    const action = await vscode.window.showWarningMessage(
      message,
      "Upgrade Plan",
      "Open Settings",
      "Cancel"
    );
    if (action === "Upgrade Plan") {
      await this.openUpgradeCheckout();
    } else if (action === "Open Settings") {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "narrate.licensing.placeholderPlan"
      );
    }
    return false;
  }

  async requireEduViewFeature(): Promise<boolean> {
    await this.initialize();

    if (!this.isBackendMode()) {
      const plan = this.getCurrentPlan();
      if (plan === "free") {
        const action = await vscode.window.showWarningMessage(
          "Narrate: Education mode requires trial or paid plan.",
          "Open Settings",
          "Cancel"
        );
        if (action === "Open Settings") {
          await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "narrate.licensing.placeholderPlan"
          );
        }
        return false;
      }
      return true;
    }

    if (await this.canUseBackendFeature("edu_view")) {
      return true;
    }

    let accessToken = await this.storage.getAccessToken();
    if (!accessToken) {
      const action = await vscode.window.showWarningMessage(
        "Narrate: sign in to start the 48h Edu trial.",
        "Sign In",
        "Cancel"
      );
      if (action !== "Sign In") {
        return false;
      }
      await this.signInWithEmail();
      accessToken = await this.storage.getAccessToken();
      if (!accessToken) {
        return false;
      }
      if (await this.canUseBackendFeature("edu_view")) {
        return true;
      }
    }

    return this.tryStartTrialForEdu(accessToken);
  }

  async signInWithEmail(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to use sign-in."
      );
      return;
    }

    const email = await vscode.window.showInputBox({
      title: "Narrate Licensing: Sign In",
      prompt: "Enter account email",
      placeHolder: "name@company.com",
      ignoreFocusOut: true
    });
    if (!email?.trim()) {
      return;
    }

    const installId = await this.storage.getOrCreateInstallId();
    const client = this.getClient();
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
    await this.storage.setAccessToken(verified.access_token);
    await this.refreshLicense("signin");
    vscode.window.showInformationMessage("Narrate: signed in and license refreshed.");
  }

  async signInWithGitHub(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to use GitHub sign-in."
      );
      return;
    }

    const installId = await this.storage.getOrCreateInstallId();
    const { accessToken, userId } = await this.waitForGitHubLoopbackToken(installId);
    if (!accessToken) {
      return;
    }

    await this.storage.setAccessToken(accessToken);
    await this.refreshLicense("signin");
    vscode.window.showInformationMessage(
      `Narrate: signed in with GitHub${userId ? ` (user ${userId})` : ""} and license refreshed.`
    );
  }

  async startTrial(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to start trial."
      );
      return;
    }
    const accessToken = await this.storage.getAccessToken();
    if (!accessToken) {
      vscode.window.showWarningMessage("Narrate: sign in first to start trial.");
      return;
    }
    const client = this.getClient();
    const result = await client.startTrial(accessToken);
    await this.refreshLicense("trial-start");
    vscode.window.showInformationMessage(
      `Narrate: trial started. Expires at ${result.trial_expires_at}.`
    );
  }

  async redeemCode(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to redeem a code."
      );
      return;
    }

    const accessToken = await this.storage.getAccessToken();
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

    const result = await this.getClient().redeemCode(accessToken, code.trim());
    await this.refreshLicense("manual");
    vscode.window.showInformationMessage(
      `Narrate: redeem applied (${result.plan_id.toUpperCase()} / ${result.module_scope}). Expires at ${result.ends_at}.`
    );
  }

  async openUpgradeCheckout(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to use checkout."
      );
      return;
    }

    const accessToken = await this.storage.getAccessToken();
    if (!accessToken) {
      const action = await vscode.window.showWarningMessage(
        "Narrate: sign in first to start checkout.",
        "Sign In",
        "Cancel"
      );
      if (action === "Sign In") {
        await this.signInWithEmail();
      } else {
        return;
      }
    }

    const refreshedToken = await this.storage.getAccessToken();
    if (!refreshedToken) {
      return;
    }

    const planPick = await vscode.window.showQuickPick<
      { label: string; value: "pro" | "team" | "enterprise" }
    >(
      [
        { label: "Pro", value: "pro" },
        { label: "Team", value: "team" },
        { label: "Enterprise", value: "enterprise" }
      ],
      { title: "Narrate Checkout: Select Plan" }
    );
    if (!planPick) {
      return;
    }

    const modulePick = await vscode.window.showQuickPick<
      { label: string; value: "narrate" | "memorybank" | "bundle" }
    >(
      [
        { label: "Narrate", value: "narrate" },
        { label: "Memory Bank", value: "memorybank" },
        { label: "Bundle (Narrate + Memory Bank)", value: "bundle" }
      ],
      { title: "Narrate Checkout: Select Module" }
    );
    if (!modulePick) {
      return;
    }

    const yearsRaw = await vscode.window.showInputBox({
      title: "Narrate Checkout: Duration (years)",
      prompt: "Enter number of years",
      value: "1",
      ignoreFocusOut: true
    });
    if (!yearsRaw?.trim()) {
      return;
    }
    const years = Math.max(1, Math.min(5, Number.parseInt(yearsRaw.trim(), 10) || 1));

    const affiliateCode = await vscode.window.showInputBox({
      title: "Narrate Checkout: Affiliate Code (optional)",
      prompt: "Leave empty if not using an affiliate code",
      ignoreFocusOut: true
    });

    const session = await this.getClient().createStripeCheckoutSession(
      refreshedToken,
      planPick.value,
      modulePick.value,
      years,
      affiliateCode?.trim() || undefined
    );

    await vscode.env.openExternal(vscode.Uri.parse(session.url));
    vscode.window.showInformationMessage("Narrate: checkout opened in your browser.");
  }

  async refreshLicense(source: "startup" | "manual" | "signin" | "trial-start"): Promise<void> {
    if (!this.isBackendMode()) {
      return;
    }

    const accessToken = await this.storage.getAccessToken();
    if (!accessToken) {
      if (source === "manual") {
        vscode.window.showWarningMessage("Narrate: sign in first to refresh license.");
      }
      return;
    }

    const installId = await this.storage.getOrCreateInstallId();
    const client = this.getClient();
    const deviceLabel = getDeviceLabel();
    const existingToken = await this.storage.getEntitlementToken();

    const refreshed = existingToken
      ? await client.refreshEntitlement(accessToken, installId, deviceLabel)
      : await client.activateEntitlement(accessToken, installId, deviceLabel);

    await this.storage.setEntitlementToken(refreshed.entitlement_token);
    await this.resolveClaimsFromToken(refreshed.entitlement_token, true);
    this.changedEmitter.fire();
  }

  async showLicenseStatus(): Promise<void> {
    await this.initialize();
    const mode = this.isBackendMode() ? "backend" : "placeholder";
    const plan = this.getCurrentPlan().toUpperCase();
    const expiry = this.entitlementClaims
      ? new Date(this.entitlementClaims.exp * 1000).toISOString()
      : "n/a";
    const installId = await this.storage.getOrCreateInstallId();

    const lines = [
      `Mode: ${mode}`,
      `Plan: ${plan}`,
      `Install ID: ${installId}`,
      `Token expires at: ${expiry}`
    ];

    if (this.entitlementClaims) {
      lines.push(
        `Features: edu_view=${this.entitlementClaims.features.edu_view}, export=${this.entitlementClaims.features.export}, change_report=${this.entitlementClaims.features.change_report}, memorybank=${this.entitlementClaims.features.memorybank}`
      );
      lines.push(
        `Project quota: used=${this.entitlementClaims.projects_used} / allowed=${this.entitlementClaims.projects_allowed}`
      );
    }

    vscode.window.showInformationMessage(`Narrate licensing\n${lines.join("\n")}`);
  }

  async activateCurrentWorkspaceProject(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to activate project quota."
      );
      return;
    }
    const accessToken = await this.storage.getAccessToken();
    if (!accessToken) {
      vscode.window.showWarningMessage("Narrate: sign in first to activate a project.");
      return;
    }

    const fingerprint = buildCurrentWorkspaceFingerprint();
    if (!fingerprint) {
      vscode.window.showWarningMessage("Narrate: open a workspace folder first.");
      return;
    }

    const result = await this.getClient().activateProject(
      accessToken,
      fingerprint.scope,
      fingerprint.repoFingerprint,
      fingerprint.repoLabel
    );

    vscode.window.showInformationMessage(
      `Narrate: project activation ${result.idempotent ? "already exists" : "created"} (${result.projects_used}/${result.projects_allowed}).`
    );
    await this.refreshLicense("manual");
  }

  async showProjectQuota(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to view project quota."
      );
      return;
    }
    const accessToken = await this.storage.getAccessToken();
    if (!accessToken) {
      vscode.window.showWarningMessage("Narrate: sign in first to view quota.");
      return;
    }

    const quota = await this.getClient().getProjectQuota(accessToken, "memorybank");
    vscode.window.showInformationMessage(
      `Narrate quota (memorybank): used=${quota.projects_used}, allowed=${quota.projects_allowed}, remaining=${quota.projects_remaining}`
    );
  }

  async manageDevices(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to manage devices."
      );
      return;
    }

    const accessToken = await this.storage.getAccessToken();
    if (!accessToken) {
      vscode.window.showWarningMessage("Narrate: sign in first to manage devices.");
      return;
    }

    const installId = await this.storage.getOrCreateInstallId();
    const devices = (await this.getClient().listDevices(accessToken)).devices;
    const activeDevices = devices.filter((item) => item.revoked_at === null);

    if (activeDevices.length === 0) {
      vscode.window.showInformationMessage("Narrate: no active devices found.");
      return;
    }

    const picked = await vscode.window.showQuickPick<DevicePickItem>(
      activeDevices.map((device) => {
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
      }),
      {
        title: "Narrate Licensing: Manage Devices",
        placeHolder: "Select a device to revoke"
      }
    );

    if (!picked) {
      return;
    }
    if (picked.isCurrent) {
      vscode.window.showWarningMessage(
        "Narrate: current device cannot be revoked from this installation."
      );
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Revoke device ${picked.label}?`,
      "Revoke",
      "Cancel"
    );
    if (confirmed !== "Revoke") {
      return;
    }

    await this.getClient().revokeDevice(accessToken, picked.id);
    vscode.window.showInformationMessage(`Narrate: revoked device ${picked.label}.`);
  }

  canUseProvider(baseUrl: string): ProviderAccessDecision {
    const policy = this.entitlementClaims?.provider_policy;
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

  async handleConfigurationChanged(): Promise<void> {
    if (!this.isBackendMode()) {
      this.entitlementClaims = undefined;
      this.changedEmitter.fire();
      return;
    }
    await this.initialize();
    this.changedEmitter.fire();
  }

  private async canUseBackendFeature(feature: keyof EntitlementClaims["features"]): Promise<boolean> {
    if (!this.entitlementClaims) {
      try {
        await this.refreshLicense("startup");
      } catch (error) {
        this.logger.warn(`Licensing refresh failed: ${toErrorMessage(error)}`);
      }
    }
    if (!this.entitlementClaims) {
      return false;
    }
    return Boolean(this.entitlementClaims.features[feature]);
  }

  private async tryStartTrialForEdu(accessToken: string): Promise<boolean> {
    try {
      const result = await this.getClient().startTrial(accessToken);
      await this.refreshLicense("trial-start");
      vscode.window.showInformationMessage(
        `Narrate: trial started. Expires at ${result.trial_expires_at}.`
      );
      return this.canUseBackendFeature("edu_view");
    } catch (error) {
      const message = toErrorMessage(error);
      this.logger.warn(`Edu trial start failed: ${message}`);
      const action = await vscode.window.showWarningMessage(
        `Narrate: Education mode unavailable. ${message}`,
        "Refresh License",
        "License Status",
        "Cancel"
      );
      if (action === "Refresh License") {
        await this.refreshLicense("manual");
      } else if (action === "License Status") {
        await this.showLicenseStatus();
      }
      return false;
    }
  }

  private async waitForGitHubLoopbackToken(
    installId: string
  ): Promise<{ accessToken?: string; userId?: string }> {
    const timeoutMs = 5 * 60 * 1000;
    let resolvePromise: ((value: { accessToken?: string; userId?: string }) => void) | undefined;
    let rejectPromise: ((error: Error) => void) | undefined;
    const resultPromise = new Promise<{ accessToken?: string; userId?: string }>(
      (resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      }
    );

    const server = createServer((req, res) => {
      this.handleGitHubLoopbackRequest(req, res, resolvePromise);
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", (error) => reject(error instanceof Error ? error : new Error(String(error))));
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address() as AddressInfo | null;
    if (!address || typeof address.port !== "number") {
      server.close();
      throw new Error("Unable to start local OAuth callback listener.");
    }

    const callbackUrl = `http://127.0.0.1:${address.port}/callback`;
    const startUrl = new URL("/auth/github/start", this.getApiBaseUrl());
    startUrl.searchParams.set("install_id", installId);
    startUrl.searchParams.set("callback_url", callbackUrl);

    const timeout = setTimeout(() => {
      rejectPromise?.(new Error("GitHub sign-in timed out."));
    }, timeoutMs);

    try {
      await vscode.env.openExternal(vscode.Uri.parse(startUrl.toString()));
      return await resultPromise;
    } finally {
      clearTimeout(timeout);
      server.close();
    }
  }

  private handleGitHubLoopbackRequest(
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    resolvePromise: ((value: { accessToken?: string; userId?: string }) => void) | undefined
  ): void {
    const requestUrl = req.url ? new URL(req.url, "http://127.0.0.1") : undefined;
    if (!requestUrl || requestUrl.pathname !== "/callback") {
      res.statusCode = 404;
      res.end("Not found.");
      return;
    }

    const status = requestUrl.searchParams.get("status") || "error";
    const accessToken = requestUrl.searchParams.get("access_token") || undefined;
    const userId = requestUrl.searchParams.get("user_id") || undefined;
    const message = requestUrl.searchParams.get("message") || "";

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (status === "ok" && accessToken) {
      res.end("<html><body><h3>Narrate GitHub sign-in complete.</h3><p>You can close this window.</p></body></html>");
      resolvePromise?.({ accessToken, userId });
      return;
    }

    res.end("<html><body><h3>Narrate GitHub sign-in failed.</h3><p>You can close this window.</p></body></html>");
    void vscode.window.showErrorMessage(`Narrate: GitHub sign-in failed. ${message || "Unknown error."}`);
    resolvePromise?.({});
  }

  private isBackendMode(): boolean {
    return (
      vscode.workspace.getConfiguration("narrate.licensing").get<string>("mode", "placeholder") ===
      "backend"
    );
  }

  private getApiBaseUrl(): string {
    const config = vscode.workspace.getConfiguration("narrate.licensing");
    return config.get<string>("apiBaseUrl", "http://127.0.0.1:8787").trim();
  }

  private getClient(): EntitlementClient {
    return new EntitlementClient(this.getApiBaseUrl(), this.logger);
  }

  private async loadCachedTokenOnly(): Promise<void> {
    const token = await this.storage.getEntitlementToken();
    if (!token) {
      this.entitlementClaims = undefined;
      this.changedEmitter.fire();
      return;
    }
    try {
      await this.resolveClaimsFromToken(token, false);
      this.changedEmitter.fire();
    } catch (error) {
      this.logger.warn(`Unable to load cached entitlement token: ${toErrorMessage(error)}`);
      this.entitlementClaims = undefined;
      this.changedEmitter.fire();
    }
  }

  private async resolveClaimsFromToken(token: string, strictVerify: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration("narrate.licensing");
    const configuredPublicKey = config.get<string>("publicKeyPem", "").trim();

    let publicKey = configuredPublicKey || (await this.storage.getEntitlementPublicKey()) || "";
    if (!publicKey && strictVerify) {
      const remote = await this.getClient().getPublicKey();
      publicKey = remote.public_key_pem;
      await this.storage.setEntitlementPublicKey(publicKey);
    }

    if (publicKey) {
      this.entitlementClaims = this.verifier.verifySignedToken(token, publicKey);
      return;
    }

    if (strictVerify) {
      throw new Error("Missing public key for entitlement verification.");
    }

    this.entitlementClaims = this.verifier.decodeUnsignedToken(token);
  }
}

interface DevicePickItem extends vscode.QuickPickItem {
  id: string;
  installId: string;
  isCurrent: boolean;
}

export interface ProviderAccessDecision {
  allowed: boolean;
  reason?: string;
}

function inferFeatureKey(
  featureName: string
): keyof EntitlementClaims["features"] {
  if (featureName.toLowerCase().includes("change report")) {
    return "change_report";
  }
  return "export";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getDeviceLabel(): string {
  return `${process.platform}:${process.arch}`;
}

function isLocalHost(host: string): boolean {
  return (
    host.startsWith("127.0.0.1") ||
    host.startsWith("localhost") ||
    host.startsWith("[::1]")
  );
}
