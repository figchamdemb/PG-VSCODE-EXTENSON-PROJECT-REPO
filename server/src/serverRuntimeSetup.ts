import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { FastifyInstance } from "fastify";

interface RuntimeSetupOptions {
  publicDir: string;
  cloudflareAccessEnabled: boolean;
  cloudflareAccessTeamDomain: string;
  cloudflareAccessAud: string;
  onWarn: (message: string) => void;
}

export async function configureServerRuntime(
  app: FastifyInstance,
  options: RuntimeSetupOptions
): Promise<void> {
  await registerCorePlugins(app, options.publicDir);
  registerJsonParser(app);
  registerFormParser(app);
  warnIfCloudflareConfigIncomplete(options);
  registerSecurityHeaders(app);
}

async function registerCorePlugins(app: FastifyInstance, publicDir: string): Promise<void> {
  await app.register(cookie);
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    global: false,
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true
    }
  });
  await app.register(fastifyStatic, { root: publicDir, prefix: "/" });
}

function registerJsonParser(app: FastifyInstance): void {
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    try {
      const trimmed = typeof body === "string" ? body.trim() : "";
      if (!trimmed) {
        done(null, {});
        return;
      }
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        (parsed as Record<string, unknown>).__raw_json_body = body;
        done(null, parsed);
        return;
      }
      done(null, { value: parsed, __raw_json_body: body });
    } catch (error) {
      done(error as Error, undefined);
    }
  });
}

function registerFormParser(app: FastifyInstance): void {
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      const raw = typeof body === "string" ? body : "";
      const params = new URLSearchParams(raw);
      const parsed: Record<string, unknown> = { __raw_form_body: raw };
      for (const [key, value] of params.entries()) {
        const existing = parsed[key];
        if (existing === undefined) {
          parsed[key] = value;
        } else if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          parsed[key] = [existing, value];
        }
      }
      done(null, parsed);
    }
  );
}

function warnIfCloudflareConfigIncomplete(options: RuntimeSetupOptions): void {
  if (
    options.cloudflareAccessEnabled &&
    (!options.cloudflareAccessTeamDomain || !options.cloudflareAccessAud)
  ) {
    options.onWarn(
      "Cloudflare Access is enabled but CLOUDFLARE_ACCESS_TEAM_DOMAIN or CLOUDFLARE_ACCESS_AUD is missing."
    );
  }
}

function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "same-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    return payload;
  });
}
