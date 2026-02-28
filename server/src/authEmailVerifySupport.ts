import { FastifyReply, FastifyRequest } from "fastify";
import { StateStore } from "./store";
import { PlanTier, StoreState } from "./types";

type EmailVerifyPayload = {
  email: string;
  code: string;
  installId: string;
};

type EmailVerifyChallengeError = {
  statusCode: number;
  error: string;
};

type ResolveEffectivePlanResult = {
  plan: PlanTier;
};

type ResolveEffectivePlanFn = (
  state: StoreState,
  userId: string,
  now: Date
) => ResolveEffectivePlanResult;

type EnsureDeviceRecordFn = (
  state: StoreState,
  userId: string,
  installId: string,
  deviceLabel: string,
  deviceLimit: number
) => void;

type SetSessionCookieFn = (
  reply: FastifyReply,
  request: FastifyRequest,
  token: string
) => void;

export type HandleEmailVerifyRequestOptions = {
  enableEmailOtp: boolean;
  store: StateStore;
  normalizeEmail: (value: string | undefined) => string | undefined;
  randomUuid: () => string;
  randomSessionToken: () => string;
  addHours: (date: Date, hours: number) => Date;
  sessionTtlHours: number;
  resolveEffectivePlan: ResolveEffectivePlanFn;
  resolveDeviceLimitForPlan: (plan: PlanTier) => number;
  ensureDeviceRecord: EnsureDeviceRecordFn;
  setSessionCookie: SetSessionCookieFn;
  toErrorMessage: (error: unknown) => string;
};

export async function handleEmailVerifyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  options: HandleEmailVerifyRequestOptions
) {
  if (!options.enableEmailOtp) {
    return reply.code(403).send({ error: "email OTP sign-in is disabled" });
  }
  const payload = parseEmailVerifyPayload(
    request.body as { email?: string; code?: string; install_id?: string },
    options.normalizeEmail
  );
  if (!payload) {
    return reply.code(400).send({ error: "email, code and install_id are required" });
  }

  const challengeError = validateEmailVerifyChallenge(
    options.store.snapshot(),
    payload.email,
    payload.code
  );
  if (challengeError) {
    return reply.code(challengeError.statusCode).send({ error: challengeError.error });
  }

  const nowIso = new Date().toISOString();
  const userId = await upsertEmailVerifiedUser(options.store, payload.email, nowIso, options.randomUuid);
  const sessionToken = options.randomSessionToken();
  const sessionError = await createEmailVerifiedSession(
    payload,
    userId,
    sessionToken,
    nowIso,
    options
  );
  if (sessionError) {
    return reply.code(403).send({ error: sessionError });
  }

  options.setSessionCookie(reply, request, sessionToken);
  return {
    access_token: sessionToken,
    expires_in_sec: options.sessionTtlHours * 3600,
    user_id: userId
  };
}

function parseEmailVerifyPayload(
  body: { email?: string; code?: string; install_id?: string },
  normalizeEmail: (value: string | undefined) => string | undefined
): EmailVerifyPayload | null {
  const email = normalizeEmail(body?.email);
  const code = body?.code?.trim();
  const installId = body?.install_id?.trim();
  if (!email || !code || !installId) {
    return null;
  }
  return { email, code, installId };
}

function validateEmailVerifyChallenge(
  snapshot: StoreState,
  email: string,
  code: string
): EmailVerifyChallengeError | null {
  const challenge = snapshot.auth_challenges.find((item) => item.email === email);
  if (!challenge) {
    return { statusCode: 400, error: "verification code not found" };
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return { statusCode: 400, error: "verification code expired" };
  }
  if (challenge.code !== code) {
    return { statusCode: 401, error: "invalid verification code" };
  }
  return null;
}

async function upsertEmailVerifiedUser(
  store: StateStore,
  email: string,
  nowIso: string,
  randomUuid: () => string
): Promise<string> {
  const existingUser = store.snapshot().users.find((item) => item.email === email);
  if (existingUser) {
    await store.update((state) => {
      const user = state.users.find((item) => item.id === existingUser.id);
      if (user) {
        user.last_login_at = nowIso;
      }
    });
    return existingUser.id;
  }

  const createdUserId = randomUuid();
  await store.update((state) => {
    state.users.push({
      id: createdUserId,
      email,
      created_at: nowIso,
      last_login_at: nowIso
    });
  });
  return createdUserId;
}

async function createEmailVerifiedSession(
  payload: EmailVerifyPayload,
  userId: string,
  sessionToken: string,
  nowIso: string,
  options: HandleEmailVerifyRequestOptions
): Promise<string | null> {
  try {
    await options.store.update((state) => {
      const effectivePlan = options.resolveEffectivePlan(state, userId, new Date());
      const deviceLimit = options.resolveDeviceLimitForPlan(effectivePlan.plan);
      state.auth_challenges = state.auth_challenges.filter((item) => item.email !== payload.email);
      state.sessions.push({
        token: sessionToken,
        user_id: userId,
        created_at: nowIso,
        expires_at: options.addHours(new Date(), options.sessionTtlHours).toISOString()
      });
      options.ensureDeviceRecord(state, userId, payload.installId, "auth-verify", deviceLimit);
    });
  } catch (error) {
    const message = options.toErrorMessage(error);
    if (message === "device limit reached" || message === "device revoked") {
      return message;
    }
    throw error;
  }
  return null;
}
