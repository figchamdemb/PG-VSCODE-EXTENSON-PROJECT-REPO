import jwt, { JwtPayload } from "jsonwebtoken";
import { EntitlementClaims } from "./types";

function normalizeClaims(payload: JwtPayload): EntitlementClaims {
  const required = [
    "sub",
    "install_id",
    "plan",
    "features",
    "modules",
    "projects_allowed",
    "projects_used",
    "token_max_ttl_hours",
    "provider_policy",
    "exp",
    "iat"
  ] as const;

  for (const key of required) {
    if (payload[key] === undefined) {
      throw new Error(`Invalid entitlement token payload: missing ${key}`);
    }
  }

  return payload as unknown as EntitlementClaims;
}

export class EntitlementTokenVerifier {
  verifySignedToken(token: string, publicKeyPem: string): EntitlementClaims {
    const verified = jwt.verify(token, publicKeyPem, {
      algorithms: ["ES256", "RS256"]
    });
    if (typeof verified === "string") {
      throw new Error("Invalid entitlement token payload format.");
    }
    return normalizeClaims(verified as JwtPayload);
  }

  decodeUnsignedToken(token: string): EntitlementClaims {
    const decoded = jwt.decode(token, { json: true });
    if (!decoded || typeof decoded === "string") {
      throw new Error("Invalid entitlement token.");
    }
    return normalizeClaims(decoded as JwtPayload);
  }
}
