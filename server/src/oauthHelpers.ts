import { randomBytes, randomUUID } from "crypto";
import { FastifyReply } from "fastify";
import { StateStore } from "./store";
import {
  isLoopbackCallbackUrl,
  normalizeEmail
} from "./serverUtils";
import { UserRecord } from "./types";

export interface CreateOAuthHelpersDeps {
  store: StateStore;
  githubClientId: string;
  githubClientSecret: string;
  githubRedirectUri: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  oauthCallbackOrigins: string[];
  oauthCallbackSchemes: Set<string>;
  oauthEditorCallbackHosts: Set<string>;
}

// ---------------------------------------------------------------------------
// Factory – thin delegation layer.
// ---------------------------------------------------------------------------
export function createOAuthHelpers(deps: CreateOAuthHelpersDeps) {
  return createOAuthHelperSurface(deps);
}

// ---------------------------------------------------------------------------
// Implementation functions (module-level, not exported).
// ---------------------------------------------------------------------------

type ReplyAfterOAuthPayload = {
  status: "ok" | "error";
  message?: string;
  access_token?: string;
  expires_in_sec?: number;
  user_id?: string;
};

function createOAuthHelperSurface(deps: CreateOAuthHelpersDeps) {
  return {
    isAllowedOAuthCallbackUrl: (callbackUrl: string) => isAllowedOAuthCallbackUrl(deps, callbackUrl),
    consumeOAuthState: (provider: "github" | "google", stateToken: string) =>
      consumeOAuthState(deps, provider, stateToken),
    exchangeGitHubOAuthCode: (code: string, stateValue: string) => exchangeGitHubOAuthCode(deps, code, stateValue),
    exchangeGoogleOAuthCode: (code: string) => exchangeGoogleOAuthCode(deps, code),
    fetchGitHubProfile: (accessToken: string) => fetchGitHubProfile(accessToken),
    fetchGoogleProfile: (accessToken: string) => fetchGoogleProfile(accessToken),
    resolveGitHubPrimaryEmail: (accessToken: string, profileEmail?: string) =>
      resolveGitHubPrimaryEmail(accessToken, profileEmail),
    findUserByEmail: (email: string) => findUserByEmail(deps, email),
    getOrCreateUserByEmail: (email: string, options?: { touchLastLogin?: boolean; createIfMissing?: boolean }) =>
      getOrCreateUserByEmail(deps, email, options),
    replyAfterOAuth: (callbackUrl: string | null, reply: FastifyReply, payload: ReplyAfterOAuthPayload) =>
      replyAfterOAuth(deps, callbackUrl, reply, payload)
  };
}

function isAllowedOAuthCallbackUrl(
  deps: CreateOAuthHelpersDeps,
  callbackUrl: string
): boolean {
  if (isLoopbackCallbackUrl(callbackUrl)) {
    return true;
  }
  try {
    const parsed = new URL(callbackUrl);
    const scheme = parsed.protocol.replace(/:$/u, "").toLowerCase();
    if (deps.oauthCallbackSchemes.has(scheme)) {
      return deps.oauthEditorCallbackHosts.has(parsed.host.toLowerCase());
    }
    const protocolAllowed =
      parsed.protocol === "https:" || parsed.protocol === "http:";
    if (!protocolAllowed) {
      return false;
    }
    return deps.oauthCallbackOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}

async function consumeOAuthState(
  deps: CreateOAuthHelpersDeps,
  provider: "github" | "google",
  stateToken: string
) {
  if (deps.store.consumeOAuthStateRecord) {
    return deps.store.consumeOAuthStateRecord(provider, stateToken);
  }
  const snapshot = deps.store.snapshot();
  const record = snapshot.oauth_states.find(
    (item) =>
      item.provider === provider &&
      item.state === stateToken &&
      item.consumed_at === null &&
      new Date(item.expires_at).getTime() > Date.now()
  );
  if (!record) {
    return undefined;
  }
  await deps.store.update((state) => {
    const mutable = state.oauth_states.find(
      (item) => item.id === record.id
    );
    if (!mutable || mutable.consumed_at !== null) {
      throw new Error("oauth state already consumed");
    }
    mutable.consumed_at = new Date().toISOString();
  });
  return record;
}

async function exchangeGitHubOAuthCode(
  deps: CreateOAuthHelpersDeps,
  code: string,
  stateValue: string
): Promise<string> {
  if (!deps.githubClientId || !deps.githubClientSecret) {
    throw new Error("GitHub OAuth is not configured.");
  }

  const response = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: deps.githubClientId,
        client_secret: deps.githubClientSecret,
        code,
        redirect_uri: deps.githubRedirectUri,
        state: stateValue
      })
    }
  );
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    const err =
      typeof payload.error_description === "string"
        ? payload.error_description
        : "unknown";
    throw new Error(`GitHub token exchange failed: ${err}`);
  }
  return payload.access_token;
}

async function exchangeGoogleOAuthCode(
  deps: CreateOAuthHelpersDeps,
  code: string
): Promise<string> {
  if (!deps.googleClientId || !deps.googleClientSecret) {
    throw new Error("Google OAuth is not configured.");
  }
  const form = new URLSearchParams();
  form.set("client_id", deps.googleClientId);
  form.set("client_secret", deps.googleClientSecret);
  form.set("code", code);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", deps.googleRedirectUri);
  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    const err =
      typeof payload.error_description === "string"
        ? payload.error_description
        : "unknown";
    throw new Error(`Google token exchange failed: ${err}`);
  }
  return payload.access_token;
}

async function fetchGitHubProfile(
  accessToken: string
): Promise<{ id: number; email?: string }> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "narrate-licensing-server"
    }
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof payload.id !== "number") {
    throw new Error("GitHub profile fetch failed.");
  }
  return {
    id: payload.id,
    email:
      typeof payload.email === "string" ? payload.email : undefined
  };
}

async function fetchGoogleProfile(accessToken: string): Promise<{
  email?: string;
  email_verified?: boolean;
}> {
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error("Google profile fetch failed.");
  }
  return {
    email:
      typeof payload.email === "string" ? payload.email : undefined,
    email_verified: payload.email_verified === true
  };
}

async function resolveGitHubPrimaryEmail(
  accessToken: string,
  profileEmail?: string
): Promise<string | undefined> {
  const normalizedProfile = normalizeEmail(profileEmail);
  if (normalizedProfile) {
    return normalizedProfile;
  }

  const response = await fetch(
    "https://api.github.com/user/emails",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "narrate-licensing-server"
      }
    }
  );
  const payload = (await response.json()) as Array<
    Record<string, unknown>
  >;
  if (!response.ok || !Array.isArray(payload)) {
    return undefined;
  }
  const primary = payload.find(
    (item) =>
      item.primary === true &&
      item.verified === true &&
      typeof item.email === "string"
  );
  if (primary && typeof primary.email === "string") {
    return normalizeEmail(primary.email);
  }
  const fallback = payload.find(
    (item) =>
      item.verified === true && typeof item.email === "string"
  );
  if (fallback && typeof fallback.email === "string") {
    return normalizeEmail(fallback.email);
  }
  return undefined;
}

function findUserByEmail(
  deps: CreateOAuthHelpersDeps,
  email: string
): UserRecord | undefined {
  const user = deps.store
    .snapshot()
    .users.find((item) => item.email === email);
  if (!user) {
    return undefined;
  }
  return { ...user };
}

async function getOrCreateUserByEmail(
  deps: CreateOAuthHelpersDeps,
  email: string,
  options: {
    touchLastLogin?: boolean;
    createIfMissing?: boolean;
  } = {}
): Promise<UserRecord> {
  return getOrCreateUserByEmailInternal(deps, email, {
    touchLastLogin: options.touchLastLogin ?? true,
    createIfMissing: options.createIfMissing ?? true
  });
}

async function getOrCreateUserByEmailInternal(
  deps: CreateOAuthHelpersDeps,
  email: string,
  options: {
    touchLastLogin: boolean;
    createIfMissing: boolean;
  }
): Promise<UserRecord> {
  const existing = findUserByEmail(deps, email);
  if (existing && !options.touchLastLogin) {
    return existing;
  }
  if (!existing && !options.createIfMissing) {
    throw new Error(`User not found for email: ${email}`);
  }

  let userRecord: UserRecord | undefined;
  await deps.store.update((state) => {
    const nowIso = new Date().toISOString();
    let user = state.users.find((item) => item.email === email);
    if (!user) {
      user = {
        id: randomUUID(),
        email,
        created_at: nowIso,
        last_login_at: nowIso
      };
      state.users.push(user);
    } else {
      if (options.touchLastLogin) {
        user.last_login_at = nowIso;
      }
    }
    userRecord = { ...user };
  });
  if (!userRecord) {
    throw new Error("Unable to create user.");
  }
  return userRecord;
}

function replyAfterOAuth(
  deps: CreateOAuthHelpersDeps,
  callbackUrl: string | null,
  reply: FastifyReply,
  payload: ReplyAfterOAuthPayload
) {
  if (callbackUrl && isAllowedOAuthCallbackUrl(deps, callbackUrl)) {
    const target = new URL(callbackUrl);
    const includeTokenInUrl = !isPortalCallbackUrl(target);
    target.searchParams.set("status", payload.status);
    if (payload.message) {
      target.searchParams.set("message", payload.message);
    }
    if (payload.access_token && includeTokenInUrl) {
      target.searchParams.set(
        "access_token",
        payload.access_token
      );
    }
    if (payload.expires_in_sec) {
      target.searchParams.set(
        "expires_in_sec",
        String(payload.expires_in_sec)
      );
    }
    if (payload.user_id) {
      target.searchParams.set("user_id", payload.user_id);
    }
    return reply.redirect(target.toString());
  }
  return reply.send(payload);
}

function isPortalCallbackUrl(target: URL): boolean {
  return target.pathname === "/app";
}
