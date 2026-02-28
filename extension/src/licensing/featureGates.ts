import * as vscode from "vscode";
import { Logger } from "../utils/logger";
import { formatPlanLabel, isProOrHigher, normalizePlan, PlanTier } from "./plans";
import { EntitlementClient } from "./entitlementClient";
import { LicensingSecretStorage } from "./secretStorage";
import { EntitlementTokenVerifier } from "./tokenVerifier";
import { EntitlementClaims } from "./types";
import {
  evaluateProviderAccess,
  FeatureGateActionContext,
  runActivateCurrentWorkspaceProject,
  runManageDevices,
  runOpenUpgradeCheckout,
  runRedeemCode,
  runShowLicenseStatus,
  runShowProjectQuota,
  runSignInWithEmail,
  runSignInWithGitHub,
  runStartTrial
} from "./featureGateActions";

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
      return this.requireBackendProFeature(featureName);
    }
    return this.requirePlaceholderProFeature(featureName);
  }

  private async requireBackendProFeature(featureName: string): Promise<boolean> {
    const featureKey: keyof EntitlementClaims["features"] = featureName
      .toLowerCase()
      .includes("change report")
      ? "change_report"
      : "export";
    if (await this.canUseBackendFeature(featureKey)) {
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
    await this.handleBackendProFeatureAction(action);
    return false;
  }

  private async handleBackendProFeatureAction(action: string | undefined): Promise<void> {
    if (action === "Refresh License") {
      await this.refreshLicense("manual");
      return;
    }
    if (action === "Start Trial") {
      await this.startTrial();
      return;
    }
    if (action === "Sign In") {
      await this.signInWithEmail();
      return;
    }
    if (action === "Upgrade Plan") {
      await this.openUpgradeCheckout();
      return;
    }
    if (action === "Open Settings") {
      await this.openLicensingSetting("narrate.licensing.mode");
    }
  }

  private async requirePlaceholderProFeature(featureName: string): Promise<boolean> {
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
    await this.handlePlaceholderProFeatureAction(action);
    return false;
  }

  private async handlePlaceholderProFeatureAction(action: string | undefined): Promise<void> {
    if (action === "Upgrade Plan") {
      await this.openUpgradeCheckout();
      return;
    }
    if (action === "Open Settings") {
      await this.openLicensingSetting("narrate.licensing.placeholderPlan");
    }
  }

  private async openLicensingSetting(settingKey: string): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettings", settingKey);
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
    await runSignInWithEmail(this.getActionContext());
  }

  async signInWithGitHub(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to use GitHub sign-in."
      );
      return;
    }
    await runSignInWithGitHub(this.getActionContext());
  }

  async startTrial(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to start trial."
      );
      return;
    }
    await runStartTrial(this.getActionContext());
  }

  async redeemCode(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to redeem a code."
      );
      return;
    }
    await runRedeemCode(this.getActionContext());
  }

  async openUpgradeCheckout(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to use checkout."
      );
      return;
    }
    await runOpenUpgradeCheckout(this.getActionContext());
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
    await runShowLicenseStatus(
      this.getActionContext(),
      mode,
      this.getCurrentPlan().toUpperCase(),
      this.entitlementClaims
    );
  }

  async activateCurrentWorkspaceProject(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to activate project quota."
      );
      return;
    }
    await runActivateCurrentWorkspaceProject(this.getActionContext());
  }

  async showProjectQuota(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to view project quota."
      );
      return;
    }
    await runShowProjectQuota(this.getActionContext());
  }

  async manageDevices(): Promise<void> {
    if (!this.isBackendMode()) {
      vscode.window.showWarningMessage(
        "Narrate: set narrate.licensing.mode to backend to manage devices."
      );
      return;
    }
    await runManageDevices(this.getActionContext());
  }

  canUseProvider(baseUrl: string): ProviderAccessDecision {
    return evaluateProviderAccess(this.entitlementClaims?.provider_policy, baseUrl);
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

  private getActionContext(): FeatureGateActionContext {
    return {
      logger: this.logger,
      storage: this.storage,
      getApiBaseUrl: () => this.getApiBaseUrl(),
      getClient: () => this.getClient(),
      refreshLicense: (source) => this.refreshLicense(source)
    };
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

export interface ProviderAccessDecision {
  allowed: boolean;
  reason?: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getDeviceLabel(): string {
  return `${process.platform}:${process.arch}`;
}
