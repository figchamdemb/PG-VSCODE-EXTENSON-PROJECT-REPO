import { randomBytes, randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { StateStore } from "./store";
import { ensureDeviceRecord, resolveEffectivePlan } from "./entitlementHelpers";
import { addHours, addMinutes, normalizeEmail, toErrorMessage } from "./serverUtils";
import { PLAN_RULES } from "./rules";
import { UserRecord } from "./types";

export interface RegisterAuthOAuthRoutesDeps {
  store: StateStore;
  githubClientId: string;
  githubClientSecret: string;
  githubRedirectUri: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  sessionTtlHours: number;
  oauthStateTtlMinutes: number;
  authStartRateLimitMax: number;
  authStartRateLimitWindow: string;
  isAllowedOAuthCallbackUrl: (callbackUrl: string) => boolean;
  consumeOAuthState: (
    provider: "github" | "google",
    stateToken: string
  ) => Promise<{
    install_id: string | null;
    callback_url: string | null;
  } | null | undefined>;
  exchangeGitHubOAuthCode: (code: string, stateValue: string) => Promise<string>;
  exchangeGoogleOAuthCode: (code: string) => Promise<string>;
  fetchGitHubProfile: (accessToken: string) => Promise<{ id: number; email?: string }>;
  fetchGoogleProfile: (accessToken: string) => Promise<{
    email?: string;
    email_verified?: boolean;
    name?: string;
  }>;
  resolveGitHubPrimaryEmail: (
    accessToken: string,
    profileEmail?: string
  ) => Promise<string | undefined>;
  getOrCreateUserByEmail: (email: string) => Promise<UserRecord>;
  replyAfterOAuth: (
    callbackUrl: string | null,
    reply: FastifyReply,
    payload: {
      status: "ok" | "error";
      message?: string;
      access_token?: string;
      expires_in_sec?: number;
      user_id?: string;
    }
  ) => unknown;
  setSessionCookie: (reply: FastifyReply, request: FastifyRequest, token: string) => void;
}

export function registerAuthOAuthRoutes(
  app: FastifyInstance,
  deps: RegisterAuthOAuthRoutesDeps
): void {
  app.get<{
    Querystring: { install_id?: string; callback_url?: string };
  }>(
    "/auth/github/start",
    {
      config: {
        rateLimit: {
          max: deps.authStartRateLimitMax,
          timeWindow: deps.authStartRateLimitWindow
        }
      }
    },
    async (request, reply) => {
      if (!deps.githubClientId || !deps.githubClientSecret) {
        return reply.code(503).send({
          error: "GitHub OAuth is not configured on this server."
        });
      }
      const installId = request.query?.install_id?.trim() || null;
      const callbackUrl = request.query?.callback_url?.trim() || null;
      if (callbackUrl && !deps.isAllowedOAuthCallbackUrl(callbackUrl)) {
        return reply.code(400).send({
          error: "callback_url is not in trusted OAuth callback origins."
        });
      }
      const stateToken = randomBytes(24).toString("hex");
      await deps.store.update((state) => {
        state.oauth_states.push({
          id: randomUUID(),
          state: stateToken,
          provider: "github",
          install_id: installId,
          callback_url: callbackUrl,
          created_at: new Date().toISOString(),
          expires_at: addMinutes(new Date(), deps.oauthStateTtlMinutes).toISOString(),
          consumed_at: null
        });
      });
      const githubAuthorizeUrl = new URL("https://github.com/login/oauth/authorize");
      githubAuthorizeUrl.searchParams.set("client_id", deps.githubClientId);
      githubAuthorizeUrl.searchParams.set("redirect_uri", deps.githubRedirectUri);
      githubAuthorizeUrl.searchParams.set("scope", "read:user user:email");
      githubAuthorizeUrl.searchParams.set("state", stateToken);
      return reply.redirect(githubAuthorizeUrl.toString());
    }
  );

  app.get<{
    Querystring: { state?: string; code?: string; error?: string; error_description?: string };
  }>("/auth/github/callback", async (request, reply) => {
    const stateValue = request.query?.state?.trim();
    const code = request.query?.code?.trim();
    const oauthError = request.query?.error?.trim();
    const oauthErrorDescription = request.query?.error_description?.trim();
    if (!stateValue) {
      return reply.code(400).send({ error: "state is required" });
    }
    const stateRecord = await deps.consumeOAuthState("github", stateValue);
    if (!stateRecord) {
      return reply.code(400).send({ error: "oauth state is invalid or expired" });
    }
    if (oauthError) {
      return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: oauthErrorDescription || oauthError
      });
    }
    if (!code) {
      return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: "Missing OAuth code."
      });
    }
    try {
      const githubToken = await deps.exchangeGitHubOAuthCode(code, stateValue);
      const profile = await deps.fetchGitHubProfile(githubToken);
      const email = await deps.resolveGitHubPrimaryEmail(githubToken, profile.email);
      if (!email) {
        return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
          status: "error",
          message: "GitHub account does not provide a verified email."
        });
      }
      const user = await deps.getOrCreateUserByEmail(email);
      const sessionToken = randomBytes(32).toString("hex");
      await deps.store.update((storeState) => {
        const effectivePlan = resolveEffectivePlan(storeState, user.id, new Date());
        const deviceLimit = PLAN_RULES[effectivePlan.plan].device_limit;
        storeState.sessions.push({
          token: sessionToken,
          user_id: user.id,
          created_at: new Date().toISOString(),
          expires_at: addHours(new Date(), deps.sessionTtlHours).toISOString()
        });
        ensureDeviceRecord(storeState, user.id, stateRecord.install_id || "github-oauth", "github-oauth", deviceLimit);
      });
      deps.setSessionCookie(reply, request, sessionToken);
      return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "ok",
        access_token: sessionToken,
        expires_in_sec: deps.sessionTtlHours * 3600,
        user_id: user.id
      });
    } catch (error) {
      return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: toErrorMessage(error)
      });
    }
  });

  app.get<{
    Querystring: { install_id?: string; callback_url?: string };
  }>(
    "/auth/google/start",
    {
      config: {
        rateLimit: {
          max: deps.authStartRateLimitMax,
          timeWindow: deps.authStartRateLimitWindow
        }
      }
    },
    async (request, reply) => {
      if (!deps.googleClientId || !deps.googleClientSecret) {
        return reply.code(503).send({
          error: "Google OAuth is not configured on this server."
        });
      }
      const installId = request.query?.install_id?.trim() || null;
      const callbackUrl = request.query?.callback_url?.trim() || null;
      if (callbackUrl && !deps.isAllowedOAuthCallbackUrl(callbackUrl)) {
        return reply.code(400).send({
          error: "callback_url is not in trusted OAuth callback origins."
        });
      }
      const stateToken = randomBytes(24).toString("hex");
      await deps.store.update((state) => {
        state.oauth_states.push({
          id: randomUUID(),
          state: stateToken,
          provider: "google",
          install_id: installId,
          callback_url: callbackUrl,
          created_at: new Date().toISOString(),
          expires_at: addMinutes(new Date(), deps.oauthStateTtlMinutes).toISOString(),
          consumed_at: null
        });
      });
      const googleAuthorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      googleAuthorizeUrl.searchParams.set("client_id", deps.googleClientId);
      googleAuthorizeUrl.searchParams.set("redirect_uri", deps.googleRedirectUri);
      googleAuthorizeUrl.searchParams.set("response_type", "code");
      googleAuthorizeUrl.searchParams.set("scope", "openid email profile");
      googleAuthorizeUrl.searchParams.set("access_type", "offline");
      googleAuthorizeUrl.searchParams.set("prompt", "consent");
      googleAuthorizeUrl.searchParams.set("state", stateToken);
      return reply.redirect(googleAuthorizeUrl.toString());
    }
  );

  app.get<{
    Querystring: { state?: string; code?: string; error?: string; error_description?: string };
  }>("/auth/google/callback", async (request, reply) => {
    const stateValue = request.query?.state?.trim();
    const code = request.query?.code?.trim();
    const oauthError = request.query?.error?.trim();
    const oauthErrorDescription = request.query?.error_description?.trim();
    if (!stateValue) {
      return reply.code(400).send({ error: "state is required" });
    }
    const stateRecord = await deps.consumeOAuthState("google", stateValue);
    if (!stateRecord) {
      return reply.code(400).send({ error: "oauth state is invalid or expired" });
    }
    if (oauthError) {
      return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: oauthErrorDescription || oauthError
      });
    }
    if (!code) {
      return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: "Missing OAuth code."
      });
    }
    try {
      const googleToken = await deps.exchangeGoogleOAuthCode(code);
      const googleProfile = await deps.fetchGoogleProfile(googleToken);
      const email = normalizeEmail(googleProfile.email);
      if (!email) {
        return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
          status: "error",
          message: "Google account did not return an email."
        });
      }
      if (googleProfile.email_verified !== true) {
        return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
          status: "error",
          message: "Google account email is not verified."
        });
      }
      const user = await deps.getOrCreateUserByEmail(email);
      const sessionToken = randomBytes(32).toString("hex");
      await deps.store.update((storeState) => {
        const effectivePlan = resolveEffectivePlan(storeState, user.id, new Date());
        const deviceLimit = PLAN_RULES[effectivePlan.plan].device_limit;
        storeState.sessions.push({
          token: sessionToken,
          user_id: user.id,
          created_at: new Date().toISOString(),
          expires_at: addHours(new Date(), deps.sessionTtlHours).toISOString()
        });
        ensureDeviceRecord(storeState, user.id, stateRecord.install_id || "google-oauth", "google-oauth", deviceLimit);
      });
      deps.setSessionCookie(reply, request, sessionToken);
      return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "ok",
        access_token: sessionToken,
        expires_in_sec: deps.sessionTtlHours * 3600,
        user_id: user.id
      });
    } catch (error) {
      return deps.replyAfterOAuth(stateRecord.callback_url, reply, {
        status: "error",
        message: toErrorMessage(error)
      });
    }
  });
}
