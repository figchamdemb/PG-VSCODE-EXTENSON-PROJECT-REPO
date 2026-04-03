# Code Tree - auto-server

LAST_UPDATED_UTC: 2026-03-28 22:31
UPDATED_BY: agent
PROFILE: frontend

## Root Path
- server

## Tree (Key Paths)
- server/
  - .narrate/
    - stripe-runtime.local.json
  - data/
    - store.json
  - playwright-report/
  - prisma/
    - migrations/
      - 0_init/
        - migration.sql
    - schema.prisma
  - public/
    - assets/
      - checkoutReturn.js
      - help.js
      - landingPricing.js
      - pricing.js
      - pricingCatalogClient.js
      - site.adminOps.js
      - site.adminPricingCatalogEditor.js
      - site.authCards.js
      - site.js
      - site.portalLaunchContext.js
      - site.tapSignEnrollment.js
      - site.teamGovernanceOps.js
  - scripts/
    - bootstrap-governance-user.mjs
    - smoke-web.mjs
  - src/
    - apiContract/
      - codeScan.ts
      - compare.ts
      - openApi.ts
      - path.ts
      - sourceScanBackend.ts
      - sourceScanFields.ts
      - sourceScanFrontend.ts
      - sourceScanModel.ts
      - types.ts
    - accountRoutes.ts
    - accountSummaryOrchestration.ts
    - accountSummarySupport.ts
    - adminAuthHelpers.ts
    - adminRbacBootstrap.ts
    - adminRoutes.ts
    - affiliateProgram.ts
    - affiliateRoutes.ts
    - agentsPolicyProfile.ts
    - apiContractVerification.ts
    - authEmailVerifySupport.ts
    - authOAuthRoutes.ts
    - authRoutes.ts
    - cloudflareAccessHelpers.ts
    - codingStandardsFunctionScan.ts
    - codingStandardsLogSafety.ts
    - codingStandardsNestModuleRules.ts
    - codingStandardsQueryOptimization.ts
    - codingStandardsSecretSafety.ts
    - codingStandardsVerification.ts
    - dependencyReview.ts
    - dependencyVerification.ts
    - dependencyVerificationContracts.ts
    - dependencyVerificationSupport.ts
    - enforcementAuditRoutes.ts
    - entitlementHelpers.ts
    - entitlementMatrix.ts
    - governanceAdminBoardRoutes.ts
    - governanceDigestHelpers.ts
    - governanceDigestRoutes.ts
    - governanceHelpers.ts
    - governanceMastermindRoutes.ts
    - governanceNormalization.ts
    - governanceRoutes.shared.ts
    - governanceRoutes.ts
    - governanceSettingsHelpers.ts
    - governanceSettingsRoutes.ts
    - governanceSyncRoutes.ts
    - healthRoutes.ts
    - index.ts
    - integrationOrchestrationRoutes.ts
    - integrationOrchestrationSupport.ts
    - logSanitization.ts
    - mcpCloudControlRules.ts
    - mcpCloudScoreMath.ts
    - mcpCloudScoring.ts
    - mobileReviewerRoutes.ts
    - oauthHelpers.ts
    - observabilityHealth.ts
    - offlinePackCrypto.ts
    - offlinePackRoutes.ts
    - offlinePackTypes.ts
    - paymentsRoutes.ts
    - planRoutes.ts
    - policyPackRegistry.ts
    - policyRoutes.ts
    - policyThresholdResolver.ts
    - policyVaultRoutes.ts
    - policyVaultTypes.ts
    - pricingCatalog.ts
    - prismaStore.ts
    - productionChecklistEvaluator.ts
    - productionChecklistRoutes.ts
    - productionReadiness.ts
    - promptExfilGuard.ts
    - reviewerAutomationEvaluator.ts
    - reviewerAutomationRoutes.ts
    - reviewOrchestrationRoutes.ts
    - reviewOrchestrationSupport.ts
    - reviewOrchestrationTypes.ts
    - rules.ts
    - safeLogging.ts
    - scalabilityDiscoveryEvaluator.ts
    - secretEnvelopeCrypto.ts
    - serverRuntimeSetup.ts
    - serverUtils.ts
    - sessionAuthHelpers.ts
    - slackActionHandlers.ts
    - slackAsyncProcessing.ts
    - slackBlockBuilders.ts
    - slackCommandHandlers.ts
    - slackIntegration.ts
    - slackMastermindState.ts
    - slackRoutes.ts
    - store.ts
    - stripePaymentHandlers.ts
    - stripeRuntimeConfig.ts
    - stripeRuntimeManager.ts
    - stripeRuntimeStorage.ts
    - subscriptionGrant.ts
    - subscriptionHelpers.ts
    - teamHelpers.ts
    - teamRoutes.ts
    - techDebtEvaluator.ts
    - techDebtRoutes.ts
    - trustScoreEvaluation.ts
    - trustScoreEvaluationHelpers.ts
    - types.ts
  - tests/
    - pg-generated/
      - 01-smoke.generated.spec.ts
      - 02-routes.generated.spec.ts
      - 03-forms.generated.spec.ts
      - 04-input-hardening.generated.spec.ts
      - 05-accessibility.generated.spec.ts
      - 07-commerce-like.generated.spec.ts
      - _pg.generated.helpers.ts
      - README.md
    - smoke.auth.spec.ts
    - smoke.health.spec.ts
    - smoke.stripe-checkout.spec.ts
  - .env
  - .env.example
  - package-lock.json
  - package.json
  - playwright.config.ts
  - prisma.config.ts
  - README.md
  - tsconfig.json

## Key Files
| File | Purpose | Notes |
|---|---|---|
| `prisma/schema.prisma` | Schema definition | Auto-detected schema artifact |
| `prisma/migrations/0_init/migration.sql` | DB migration script | Auto-detected migration artifact |
| `src/accountRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/adminRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/affiliateRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/authOAuthRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/authRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/enforcementAuditRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/governanceAdminBoardRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/governanceDigestRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/governanceMastermindRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/governanceRoutes.shared.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/governanceRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/governanceSettingsRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/governanceSyncRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/healthRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/integrationOrchestrationRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/mobileReviewerRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/offlinePackRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/paymentsRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/planRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/policyRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/policyVaultRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/productionChecklistRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/reviewOrchestrationRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/reviewerAutomationRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/slackRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/teamRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `src/techDebtRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `tests/pg-generated/02-routes.generated.spec.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `.env` | Source/config artifact | Auto-detected |
| `.env.example` | Source/config artifact | Auto-detected |
| `README.md` | Source/config artifact | Auto-detected |
| `tests/pg-generated/README.md` | Source/config artifact | Auto-detected |
| `tsconfig.json` | Configuration/spec file | Auto-detected config artifact |
| `playwright.config.ts` | Source/config artifact | Auto-detected |
| `prisma.config.ts` | Source/config artifact | Auto-detected |
| `public/assets/checkoutReturn.js` | Source/config artifact | Auto-detected |
| `public/assets/help.js` | Source/config artifact | Auto-detected |
| `public/assets/landingPricing.js` | Source/config artifact | Auto-detected |
| `public/assets/pricing.js` | Source/config artifact | Auto-detected |
| `public/assets/pricingCatalogClient.js` | Source/config artifact | Auto-detected |
| `public/assets/site.adminOps.js` | Source/config artifact | Auto-detected |
| `public/assets/site.adminPricingCatalogEditor.js` | Source/config artifact | Auto-detected |
| `public/assets/site.authCards.js` | Source/config artifact | Auto-detected |
| `public/assets/site.js` | Source/config artifact | Auto-detected |
| `public/assets/site.portalLaunchContext.js` | Source/config artifact | Auto-detected |
| `public/assets/site.tapSignEnrollment.js` | Source/config artifact | Auto-detected |
| `public/assets/site.teamGovernanceOps.js` | Source/config artifact | Auto-detected |
| `scripts/bootstrap-governance-user.mjs` | Source/config artifact | Auto-detected |
| `scripts/smoke-web.mjs` | Source/config artifact | Auto-detected |
| `src/accountSummaryOrchestration.ts` | Source/config artifact | Auto-detected |
| `src/accountSummarySupport.ts` | Source/config artifact | Auto-detected |
| `src/adminAuthHelpers.ts` | Source/config artifact | Auto-detected |
| `src/adminRbacBootstrap.ts` | Source/config artifact | Auto-detected |
| `src/affiliateProgram.ts` | Source/config artifact | Auto-detected |
| `src/agentsPolicyProfile.ts` | Source/config artifact | Auto-detected |
| `src/apiContract/codeScan.ts` | Source/config artifact | Auto-detected |
| `src/apiContract/compare.ts` | Source/config artifact | Auto-detected |
| `src/apiContract/openApi.ts` | Source/config artifact | Auto-detected |
