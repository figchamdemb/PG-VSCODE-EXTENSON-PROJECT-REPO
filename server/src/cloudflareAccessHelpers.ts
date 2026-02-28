import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { toErrorMessage } from "./serverUtils";

export interface CreateCloudflareAccessHelpersDeps {
  cloudflareAccessTeamDomain: string;
  cloudflareAccessAud: string;
  cloudflareAccessJwksTtlSeconds: number;
}

export function createCloudflareAccessHelpers(
  deps: CreateCloudflareAccessHelpersDeps
) {
  let cloudflareCertCache: {
    fetchedAtMs: number;
    certByKid: Map<string, string>;
  } | null = null;

  async function requireCloudflareAccess(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<boolean> {
    if (
      !deps.cloudflareAccessTeamDomain ||
      !deps.cloudflareAccessAud
    ) {
      reply
        .code(503)
        .send({
          error: "Cloudflare Access is not fully configured."
        });
      return false;
    }
    const assertionHeader =
      request.headers["cf-access-jwt-assertion"];
    const assertion = Array.isArray(assertionHeader)
      ? assertionHeader[0]
      : assertionHeader;
    if (!assertion) {
      reply
        .code(401)
        .send({
          error:
            "Cloudflare Access assertion header is required."
        });
      return false;
    }

    try {
      const certificate =
        await resolveCloudflareAccessCertificate(assertion);
      const issuer = `https://${deps.cloudflareAccessTeamDomain}`;
      jwt.verify(assertion, certificate, {
        algorithms: ["RS256"],
        audience: deps.cloudflareAccessAud,
        issuer: [issuer, `${issuer}/`]
      });
      return true;
    } catch (error) {
      reply.code(401).send({
        error: `Cloudflare Access verification failed: ${toErrorMessage(error)}`
      });
      return false;
    }
  }

  async function resolveCloudflareAccessCertificate(
    token: string
  ): Promise<string> {
    const decoded = jwt.decode(token, { complete: true }) as
      | { header?: Record<string, unknown> }
      | null;
    const kid = decoded?.header?.kid;
    if (typeof kid !== "string" || !kid) {
      throw new Error("invalid JWT header: missing kid");
    }
    const certByKid = await getCloudflareAccessCertMap();
    const cert = certByKid.get(kid);
    if (!cert) {
      throw new Error(
        `Cloudflare cert not found for kid ${kid}`
      );
    }
    return cert;
  }

  async function getCloudflareAccessCertMap(): Promise<
    Map<string, string>
  > {
    const nowMs = Date.now();
    if (
      cloudflareCertCache &&
      nowMs - cloudflareCertCache.fetchedAtMs <
        deps.cloudflareAccessJwksTtlSeconds * 1000
    ) {
      return cloudflareCertCache.certByKid;
    }
    const url = `https://${deps.cloudflareAccessTeamDomain}/cdn-cgi/access/certs`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(
        `failed to fetch certs (${response.status})`
      );
    }
    const payload = (await response.json()) as Record<
      string,
      unknown
    >;
    const keys = Array.isArray(payload.keys)
      ? payload.keys
      : [];
    const certByKid = new Map<string, string>();
    for (const key of keys) {
      if (!key || typeof key !== "object") {
        continue;
      }
      const keyRecord = key as Record<string, unknown>;
      const kid =
        typeof keyRecord.kid === "string"
          ? keyRecord.kid
          : "";
      const x5c =
        Array.isArray(keyRecord.x5c) &&
        typeof keyRecord.x5c[0] === "string"
          ? keyRecord.x5c[0]
          : null;
      if (!kid || !x5c) {
        continue;
      }
      const wrapped =
        x5c.match(/.{1,64}/g)?.join("\n") ?? x5c;
      const cert = `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
      certByKid.set(kid, cert);
    }
    if (certByKid.size === 0) {
      throw new Error(
        "no valid certs in Cloudflare Access JWKS"
      );
    }
    cloudflareCertCache = { fetchedAtMs: nowMs, certByKid };
    return certByKid;
  }

  return { requireCloudflareAccess };
}
