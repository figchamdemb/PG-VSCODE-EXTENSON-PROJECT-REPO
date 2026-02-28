import { randomBytes, randomUUID } from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { StateStore } from "./store";
import {
  ensureDeviceRecord,
  resolveEffectivePlan
} from "./entitlementHelpers";
import {
  addHours,
  getBearerToken,
  normalizeEmail,
  toErrorMessage
} from "./serverUtils";
import {
  buildCatalogPlansResponse as buildCatalogPlansResponseSupport
} from "./accountSummarySupport";
import {
  handleEmailVerifyRequest as handleEmailVerifyRequestSupport
} from "./authEmailVerifySupport";
import { registerAuthOAuthRoutes, RegisterAuthOAuthRoutesDeps } from "./authOAuthRoutes";
import { PLAN_RULES } from "./rules";

export interface RegisterAuthRoutesDeps extends RegisterAuthOAuthRoutesDeps {
  enableEmailOtp: boolean;
  exposeDevOtpCode: boolean;
  authVerifyRateLimitMax: number;
  authVerifyRateLimitWindow: string;
  governanceAllowPro: boolean;
  governanceSlackAddonSeatPriceCents: number;
  clearSessionCookie: (reply: FastifyReply, request: FastifyRequest) => void;
  getSessionTokenFromCookie: (request: FastifyRequest) => string | undefined;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  deps: RegisterAuthRoutesDeps
): void {
  app.get("/catalog/plans", async () => {
    return buildCatalogPlansResponseSupport(
      PLAN_RULES,
      deps.governanceAllowPro,
      deps.governanceSlackAddonSeatPriceCents
    );
  });

  app.get("/catalog/modules", async () => {
    return {
      modules: [
        { id: "narrate", label: "Narrate module" },
        { id: "memorybank", label: "PG Memory Bank module" },
        { id: "bundle", label: "Narrate + Memory Bank bundle" }
      ]
    };
  });

  registerAuthOAuthRoutes(app, deps);

  app.get("/entitlement/public-key", async () => {
    const snapshot = deps.store.snapshot();
    return {
      alg: snapshot.keys.alg,
      public_key_pem: snapshot.keys.public_key_pem
    };
  });

  app.post<{ Body: { email?: string } }>(
    "/auth/email/start",
    {
      config: {
        rateLimit: {
          max: deps.authStartRateLimitMax,
          timeWindow: deps.authStartRateLimitWindow
        }
      }
    },
    async (request, reply) => {
      if (!deps.enableEmailOtp) {
        return reply
          .code(403)
          .send({ error: "email OTP sign-in is disabled" });
      }
      const email = normalizeEmail(request.body?.email);
      if (!email) {
        return reply
          .code(400)
          .send({ error: "email is required" });
      }
      const code = `${Math.floor(
        100000 + Math.random() * 900000
      )}`;
      const expiresAt = addHours(new Date(), 0.25).toISOString();
      await deps.store.update((state) => {
        state.auth_challenges = state.auth_challenges.filter(
          (item) => item.email !== email
        );
        state.auth_challenges.push({
          id: randomUUID(),
          email,
          code,
          created_at: new Date().toISOString(),
          expires_at: expiresAt
        });
      });
      const response: {
        status: "code_sent";
        email: string;
        expires_at: string;
        dev_code?: string;
      } = {
        status: "code_sent",
        email,
        expires_at: expiresAt
      };
      if (deps.exposeDevOtpCode) {
        response.dev_code = code;
      }
      return response;
    }
  );

  app.post<{
    Body: { email?: string; code?: string; install_id?: string };
  }>(
    "/auth/email/verify",
    {
      config: {
        rateLimit: {
          max: deps.authVerifyRateLimitMax,
          timeWindow: deps.authVerifyRateLimitWindow
        }
      }
    },
    async (request, reply) => {
      return handleEmailVerifyRequestSupport(request, reply, {
        enableEmailOtp: deps.enableEmailOtp,
        store: deps.store,
        normalizeEmail,
        randomUuid: randomUUID,
        randomSessionToken: () => randomBytes(32).toString("hex"),
        addHours,
        sessionTtlHours: deps.sessionTtlHours,
        resolveEffectivePlan,
        resolveDeviceLimitForPlan: (plan) =>
          PLAN_RULES[plan].device_limit,
        ensureDeviceRecord,
        setSessionCookie: deps.setSessionCookie,
        toErrorMessage
      });
    }
  );

  app.post("/auth/session/signout", async (request, reply) => {
    const token =
      getBearerToken(request.headers.authorization) ||
      deps.getSessionTokenFromCookie(request);
    const nowIso = new Date().toISOString();
    if (token) {
      await deps.store.update((state) => {
        const session = state.sessions.find(
          (item) => item.token === token
        );
        if (session) {
          session.expires_at = nowIso;
        }
      });
    }
    deps.clearSessionCookie(reply, request);
    return { ok: true };
  });
}
