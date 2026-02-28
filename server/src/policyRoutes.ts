import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CodingStandardsVerificationRequest,
  evaluateCodingStandardsVerification
} from "./codingStandardsVerification";
import {
  DependencyVerificationRequest,
  evaluateDependencyVerification
} from "./dependencyVerification";
import {
  ApiContractVerificationRequest,
  evaluateApiContractVerification
} from "./apiContractVerification";
import { McpCloudScoringRequest, evaluateMcpCloudScoring } from "./mcpCloudScoring";
import {
  ObservabilityHealthRequest,
  evaluateObservabilityHealth
} from "./observabilityHealth";
import { PromptGuardRequest, evaluatePromptGuard } from "./promptExfilGuard";

type AuthResult = {
  user: {
    id: string;
  };
};

export type RegisterPolicyRoutesDeps = {
  requireAuth: (
    request: FastifyRequest,
    reply: FastifyReply
  ) => AuthResult | undefined;
  safeLogInfo: (message: string, context?: Record<string, unknown>) => void;
};

export function registerPolicyRoutes(
  app: FastifyInstance,
  deps: RegisterPolicyRoutesDeps
): void {
  app.post<{ Body: DependencyVerificationRequest }>(
    "/account/policy/dependency/verify",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = await evaluateDependencyVerification(request.body ?? {});
      deps.safeLogInfo("Dependency verification completed", {
        user_id: auth.user.id,
        verification_status: result.status,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings
      });
      return result;
    }
  );

  app.post<{ Body: CodingStandardsVerificationRequest }>(
    "/account/policy/coding/verify",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluateCodingStandardsVerification(request.body ?? {});
      deps.safeLogInfo("Coding standards verification completed", {
        user_id: auth.user.id,
        verification_status: result.status,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings,
        checked_files: result.summary.checked_files
      });
      return result;
    }
  );

  app.post<{ Body: ApiContractVerificationRequest }>(
    "/account/policy/api-contract/verify",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluateApiContractVerification(request.body ?? {});
      deps.safeLogInfo("API contract verification completed", {
        user_id: auth.user.id,
        verification_status: result.status,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings,
        mismatches: result.summary.mismatches,
        unmatched_frontend_calls: result.summary.unmatched_frontend_calls
      });
      return result;
    }
  );

  app.post<{ Body: PromptGuardRequest }>(
    "/account/policy/prompt/guard",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluatePromptGuard(request.body ?? {});
      deps.safeLogInfo("Prompt guard evaluation completed", {
        user_id: auth.user.id,
        guard_status: result.status,
        risk_score: result.risk_score,
        matched_rules: result.summary.matched_rules,
        source: result.summary.source
      });
      return result;
    }
  );

  app.post<{ Body: McpCloudScoringRequest }>(
    "/account/policy/mcp/cloud-score",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluateMcpCloudScoring(request.body ?? {});
      deps.safeLogInfo("MCP cloud scoring completed", {
        user_id: auth.user.id,
        scoring_status: result.status,
        score: result.score,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings,
        scanners: result.summary.scanners,
        workload_sensitivity: result.summary.workload_sensitivity,
        source: result.summary.source
      });
      return result;
    }
  );

  app.post<{ Body: ObservabilityHealthRequest }>(
    "/account/policy/observability/check",
    async (request, reply) => {
      const auth = deps.requireAuth(request, reply);
      if (!auth) {
        return;
      }

      const result = evaluateObservabilityHealth(request.body ?? {});
      deps.safeLogInfo("Observability health check completed", {
        user_id: auth.user.id,
        status: result.status,
        deployment_profile: result.summary.deployment_profile,
        enabled_adapters: result.summary.enabled_adapters,
        ready_adapters: result.summary.ready_adapters,
        blockers: result.summary.blockers,
        warnings: result.summary.warnings
      });
      return result;
    }
  );
}
