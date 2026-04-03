import * as vscode from "vscode";
import { Logger } from "../utils/logger";

type AuthCallbackResult = {
  accessToken?: string;
  userId?: string;
};

type PendingAuthRequest = {
  resolve: (value: AuthCallbackResult) => void;
  reject: (error: Error) => void;
  timeoutHandle: NodeJS.Timeout;
};

type LicensingCallbackHandlerOptions = {
  setAccessToken: (token: string) => Promise<void>;
  refreshLicense: (source: "signin" | "manual") => Promise<void>;
};

export class LicensingCallbackHandler implements vscode.UriHandler, vscode.Disposable {
  private pendingAuthRequest: PendingAuthRequest | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger,
    private readonly options: LicensingCallbackHandlerOptions
  ) {}

  dispose(): void {
    this.clearPendingAuthRequest();
  }

  createAuthCallbackUrl(): string {
    return this.buildExtensionUri("/licensing/auth").toString();
  }

  createCheckoutReturnUrls(): { successUrl: string; cancelUrl: string } {
    return {
      successUrl: this.buildExtensionUri("/licensing/checkout", { status: "success" }).toString(),
      cancelUrl: this.buildExtensionUri("/licensing/checkout", { status: "cancel" }).toString()
    };
  }

  waitForAuthCallback(timeoutMs: number): Promise<AuthCallbackResult> {
    if (this.pendingAuthRequest) {
      throw new Error("Narrate sign-in is already waiting for a browser callback.");
    }

    return new Promise<AuthCallbackResult>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingAuthRequest = undefined;
        reject(new Error("GitHub sign-in timed out."));
      }, timeoutMs);

      this.pendingAuthRequest = {
        resolve,
        reject,
        timeoutHandle
      };
    });
  }

  abortPendingAuth(message: string): void {
    if (!this.pendingAuthRequest) {
      return;
    }
    const pending = this.pendingAuthRequest;
    this.pendingAuthRequest = undefined;
    clearTimeout(pending.timeoutHandle);
    pending.reject(new Error(message));
  }

  async handleUri(uri: vscode.Uri): Promise<void> {
    const path = normalizeUriPath(uri.path);
    if (path === "/licensing/auth") {
      await this.handleAuthCallback(uri);
      return;
    }
    if (path === "/licensing/checkout") {
      await this.handleCheckoutReturn(uri);
      return;
    }

    this.logger.warn(`Narrate licensing callback ignored for unsupported path: ${uri.toString()}`);
  }

  private buildExtensionUri(
    path: string,
    query: Record<string, string> = {}
  ): vscode.Uri {
    return vscode.Uri.from({
      scheme: vscode.env.uriScheme,
      authority: this.context.extension.id,
      path,
      query: new URLSearchParams(query).toString()
    });
  }

  private async handleAuthCallback(uri: vscode.Uri): Promise<void> {
    const params = new URLSearchParams(uri.query);
    const status = params.get("status") || "error";
    const accessToken = params.get("access_token") || undefined;
    const userId = params.get("user_id") || undefined;
    const message = params.get("message") || "Unknown error.";

    if (status === "ok" && accessToken) {
      await this.options.setAccessToken(accessToken);
      await this.options.refreshLicense("signin");
      this.resolvePendingAuth({ accessToken, userId });
      return;
    }

    this.resolvePendingAuth({});
    void vscode.window.showErrorMessage(`Narrate: GitHub sign-in failed. ${message}`);
  }

  private async handleCheckoutReturn(uri: vscode.Uri): Promise<void> {
    const params = new URLSearchParams(uri.query);
    const status = (params.get("status") || "cancel").toLowerCase();

    if (status === "success") {
      try {
        await this.options.refreshLicense("manual");
        void vscode.window.showInformationMessage(
          "Narrate: checkout completed and license refreshed for this device."
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showWarningMessage(
          `Narrate: checkout completed, but automatic license refresh failed. ${message}`
        );
      }
      return;
    }

    void vscode.window.showInformationMessage(
      "Narrate: checkout was canceled. You can retry from the extension when ready."
    );
  }

  private resolvePendingAuth(value: AuthCallbackResult): void {
    if (!this.pendingAuthRequest) {
      return;
    }
    const pending = this.pendingAuthRequest;
    this.pendingAuthRequest = undefined;
    clearTimeout(pending.timeoutHandle);
    pending.resolve(value);
  }

  private clearPendingAuthRequest(): void {
    if (!this.pendingAuthRequest) {
      return;
    }
    clearTimeout(this.pendingAuthRequest.timeoutHandle);
    this.pendingAuthRequest = undefined;
  }
}

function normalizeUriPath(value: string): string {
  if (!value.startsWith("/")) {
    return `/${value}`;
  }
  return value;
}