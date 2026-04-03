import { randomUUID } from "crypto";
import * as vscode from "vscode";

const SESSION_SLOT_KEY = "narrate.licensing.session";
const LICENSE_PROOF_SLOT_KEY = "narrate.licensing.licenseProof";
const LICENSE_PUBLIC_KEY_SLOT_KEY = "narrate.licensing.licensePublicKey";
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
    const value = await this.context.secrets.get(SESSION_SLOT_KEY);
    return value?.trim() ? value.trim() : undefined;
  }

  async setAccessToken(token: string): Promise<void> {
    await this.context.secrets.store(SESSION_SLOT_KEY, token);
  }

  async clearAccessToken(): Promise<void> {
    await this.context.secrets.delete(SESSION_SLOT_KEY);
  }

  async getEntitlementToken(): Promise<string | undefined> {
    const value = await this.context.secrets.get(LICENSE_PROOF_SLOT_KEY);
    return value?.trim() ? value.trim() : undefined;
  }

  async setEntitlementToken(token: string): Promise<void> {
    await this.context.secrets.store(LICENSE_PROOF_SLOT_KEY, token);
  }

  async clearEntitlementToken(): Promise<void> {
    await this.context.secrets.delete(LICENSE_PROOF_SLOT_KEY);
  }

  async getEntitlementPublicKey(): Promise<string | undefined> {
    const value = await this.context.secrets.get(LICENSE_PUBLIC_KEY_SLOT_KEY);
    return value?.trim() ? value.trim() : undefined;
  }

  async setEntitlementPublicKey(pem: string): Promise<void> {
    await this.context.secrets.store(LICENSE_PUBLIC_KEY_SLOT_KEY, pem);
  }

  async clearEntitlementPublicKey(): Promise<void> {
    await this.context.secrets.delete(LICENSE_PUBLIC_KEY_SLOT_KEY);
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.clearAccessToken(),
      this.clearEntitlementToken(),
      this.clearEntitlementPublicKey()
    ]);
  }
}
