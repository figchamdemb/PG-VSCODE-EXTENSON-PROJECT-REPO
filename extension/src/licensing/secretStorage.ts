import { randomUUID } from "crypto";
import * as vscode from "vscode";

const ACCESS_TOKEN_KEY = "narrate.licensing.accessToken";
const ENTITLEMENT_TOKEN_KEY = "narrate.licensing.entitlementToken";
const ENTITLEMENT_PUBLIC_KEY_KEY = "narrate.licensing.entitlementPublicKey";
const INSTALL_ID_KEY = "narrate.licensing.installId";

export class LicensingSecretStorage {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async getOrCreateInstallId(): Promise<string> {
    const existing = this.context.globalState.get<string>(INSTALL_ID_KEY);
    if (existing?.trim()) {
      return existing.trim();
    }
    const created = randomUUID();
    await this.context.globalState.update(INSTALL_ID_KEY, created);
    return created;
  }

  async getAccessToken(): Promise<string | undefined> {
    const value = await this.context.secrets.get(ACCESS_TOKEN_KEY);
    return value?.trim() ? value.trim() : undefined;
  }

  async setAccessToken(token: string): Promise<void> {
    await this.context.secrets.store(ACCESS_TOKEN_KEY, token);
  }

  async clearAccessToken(): Promise<void> {
    await this.context.secrets.delete(ACCESS_TOKEN_KEY);
  }

  async getEntitlementToken(): Promise<string | undefined> {
    const value = await this.context.secrets.get(ENTITLEMENT_TOKEN_KEY);
    return value?.trim() ? value.trim() : undefined;
  }

  async setEntitlementToken(token: string): Promise<void> {
    await this.context.secrets.store(ENTITLEMENT_TOKEN_KEY, token);
  }

  async clearEntitlementToken(): Promise<void> {
    await this.context.secrets.delete(ENTITLEMENT_TOKEN_KEY);
  }

  async getEntitlementPublicKey(): Promise<string | undefined> {
    const value = await this.context.secrets.get(ENTITLEMENT_PUBLIC_KEY_KEY);
    return value?.trim() ? value.trim() : undefined;
  }

  async setEntitlementPublicKey(pem: string): Promise<void> {
    await this.context.secrets.store(ENTITLEMENT_PUBLIC_KEY_KEY, pem);
  }

  async clearEntitlementPublicKey(): Promise<void> {
    await this.context.secrets.delete(ENTITLEMENT_PUBLIC_KEY_KEY);
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.clearAccessToken(),
      this.clearEntitlementToken(),
      this.clearEntitlementPublicKey()
    ]);
  }
}
