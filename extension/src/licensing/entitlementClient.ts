import { Logger } from "../utils/logger";
import {
  AuthStartResponse,
  AuthVerifyResponse,
  DeviceRecord,
  EntitlementStatusResponse,
  EntitlementTokenResponse,
  ProjectActivationResponse,
  ProjectQuotaResponse,
  PublicKeyResponse,
  RedeemApplyResponse,
  StripeCheckoutSessionResponse
} from "./types";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  accessToken?: string;
}

export class EntitlementClient {
  constructor(
    private readonly baseUrl: string,
    private readonly logger: Logger
  ) {}

  async getPublicKey(): Promise<PublicKeyResponse> {
    return this.request<PublicKeyResponse>("/entitlement/public-key", { method: "GET" });
  }

  async startEmailAuth(email: string): Promise<AuthStartResponse> {
    return this.request<AuthStartResponse>("/auth/email/start", {
      method: "POST",
      body: { email }
    });
  }

  async verifyEmailAuth(
    email: string,
    code: string,
    installId: string
  ): Promise<AuthVerifyResponse> {
    return this.request<AuthVerifyResponse>("/auth/email/verify", {
      method: "POST",
      body: { email, code, install_id: installId }
    });
  }

  async startTrial(accessToken: string): Promise<{ trial_expires_at: string }> {
    return this.request<{ trial_expires_at: string }>("/trial/start", {
      method: "POST",
      accessToken
    });
  }

  async activateEntitlement(
    accessToken: string,
    installId: string,
    deviceLabel: string
  ): Promise<EntitlementTokenResponse> {
    return this.request<EntitlementTokenResponse>("/entitlement/activate", {
      method: "POST",
      accessToken,
      body: { install_id: installId, device_label: deviceLabel }
    });
  }

  async refreshEntitlement(
    accessToken: string,
    installId: string,
    deviceLabel: string
  ): Promise<EntitlementTokenResponse> {
    return this.request<EntitlementTokenResponse>("/entitlement/refresh", {
      method: "POST",
      accessToken,
      body: { install_id: installId, device_label: deviceLabel }
    });
  }

  async getEntitlementStatus(accessToken: string): Promise<EntitlementStatusResponse> {
    return this.request<EntitlementStatusResponse>("/entitlement/status", {
      method: "GET",
      accessToken
    });
  }

  async listDevices(accessToken: string): Promise<{ devices: DeviceRecord[] }> {
    return this.request<{ devices: DeviceRecord[] }>("/devices/list", {
      method: "POST",
      accessToken
    });
  }

  async revokeDevice(accessToken: string, deviceId: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>("/devices/revoke", {
      method: "POST",
      accessToken,
      body: { device_id: deviceId }
    });
  }

  async redeemCode(accessToken: string, code: string): Promise<RedeemApplyResponse> {
    return this.request<RedeemApplyResponse>("/redeem/apply", {
      method: "POST",
      accessToken,
      body: { code }
    });
  }

  async createStripeCheckoutSession(
    accessToken: string,
    planId: "pro" | "team" | "enterprise",
    moduleScope: "narrate" | "memorybank" | "bundle",
    years: number,
    affiliateCode?: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<StripeCheckoutSessionResponse> {
    return this.request<StripeCheckoutSessionResponse>("/payments/stripe/create-checkout-session", {
      method: "POST",
      accessToken,
      body: {
        plan_id: planId,
        module_scope: moduleScope,
        years,
        affiliate_code: affiliateCode?.trim() || undefined,
        success_url: successUrl?.trim() || undefined,
        cancel_url: cancelUrl?.trim() || undefined
      }
    });
  }

  async activateProject(
    accessToken: string,
    scope: string,
    repoFingerprint: string,
    repoLabel: string
  ): Promise<ProjectActivationResponse> {
    return this.request<ProjectActivationResponse>("/projects/activate", {
      method: "POST",
      accessToken,
      body: {
        scope,
        repo_fingerprint: repoFingerprint,
        repo_label: repoLabel
      }
    });
  }

  async getProjectQuota(accessToken: string, scope: string): Promise<ProjectQuotaResponse> {
    const query = new URLSearchParams({ scope }).toString();
    return this.request<ProjectQuotaResponse>(`/projects/quota?${query}`, {
      method: "GET",
      accessToken
    });
  }

  private async request<T>(endpoint: string, options: RequestOptions): Promise<T> {
    const url = new URL(endpoint, this.baseUrl).toString();
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {
      Accept: "application/json"
    };
    if (options.accessToken) {
      headers.Authorization = `Bearer ${options.accessToken}`;
    }
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    this.logger.info(`Licensing API ${method} ${url}`);
    const response = await fetch(url, { method, headers, body });
    const raw = await response.text();
    const parsed = raw ? safeJson(raw) : undefined;
    if (!response.ok) {
      const message =
        typeof parsed === "object" && parsed && "error" in parsed
          ? String(parsed.error)
          : `HTTP ${response.status}`;
      throw new Error(`Licensing request failed: ${message}`);
    }
    return parsed as T;
  }
}

function safeJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return { raw: input };
  }
}
