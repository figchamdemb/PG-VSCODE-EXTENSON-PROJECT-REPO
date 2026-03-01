import { FastifyInstance } from "fastify";
import { RegisterGovernanceRoutesDeps } from "./governanceRoutes.shared";
import { registerGovernanceAdminBoardRoutes } from "./governanceAdminBoardRoutes";
import { registerGovernanceDigestRoutes } from "./governanceDigestRoutes";
import { registerGovernanceMastermindRoutes } from "./governanceMastermindRoutes";
import { registerGovernanceSettingsRoutes } from "./governanceSettingsRoutes";
import { registerGovernanceSyncRoutes } from "./governanceSyncRoutes";
import { registerMobileReviewerRoutes } from "./mobileReviewerRoutes";
import { registerReviewerAutomationRoutes } from "./reviewerAutomationRoutes";

export type { RegisterGovernanceRoutesDeps } from "./governanceRoutes.shared";

export function registerGovernanceRoutes(
  app: FastifyInstance,
  deps: RegisterGovernanceRoutesDeps
): void {
  registerGovernanceSettingsRoutes(app, deps);
  registerGovernanceMastermindRoutes(app, deps);
  registerGovernanceSyncRoutes(app, deps);
  registerGovernanceAdminBoardRoutes(app, deps);
  registerGovernanceDigestRoutes(app, deps);
  registerMobileReviewerRoutes(app, deps);
  registerReviewerAutomationRoutes(app, deps);
}
