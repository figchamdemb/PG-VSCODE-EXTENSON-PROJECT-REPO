# Code Tree - auto-root

LAST_UPDATED_UTC: 2026-03-28 22:31
UPDATED_BY: agent
PROFILE: frontend

## Root Path
- .

## Tree (Key Paths)
- PG VSCODE-EXTENSION/
  - .agents/
    - workflows/
      - startup.md
  - .githooks/
  - .narrate/
    - dev-profile.local.json
  - .tmp/
  - docs/
    - EXTENSION_PUBLISHING_GUIDE.md
    - FINAL_PASS_FAIL_TEMPLATE.md
    - FRONTEND_DESIGN_GUARDRAILS.md
    - FRONTEND_INTEGRATION_PROTOCOL_PROPOSAL.md
    - LOCAL_VSIX_INSTALL_AND_UI_TEST.md
    - PG_FIRST_RUN_GUIDE.md
    - PG_REVIEW_WORKFLOW_PROPOSAL.md
    - PG_SCAFFOLD_UPGRADE_COMMAND_PROPOSAL.md
    - PRODUCTION_DEPLOYMENT_GUIDE.md
    - TESTING_GUIDE.md
  - extension/
    - resources/
    - src/
      - activation/
        - statusBars.ts
      - cache/
        - cacheProvider.ts
        - hashing.ts
        - jsonCacheProvider.ts
      - commands/
        - .narrate/
        - activateProjectQuota.ts
        - apiContractAnalyzer.ts
        - apiContractCodeScan.ts
        - apiContractCompare.ts
        - apiContractHandoffPrompt.ts
        - apiContractOpenApi.ts
        - apiContractPath.ts
        - apiContractReport.ts
        - apiContractSourceScanBackend.ts
        - apiContractSourceScanFields.ts
        - apiContractSourceScanFrontend.ts
        - apiContractSourceScanModel.ts
        - apiContractTypedClientScan.ts
        - apiContractTypes.ts
        - applySafeDeadCodeFixes.ts
        - authSignIn.ts
        - authSignInGitHub.ts
        - codebaseTourGraph.ts
        - codebaseTourReport.ts
        - codebaseTourTypes.ts
        - createDeadCodeCleanupBranch.ts
        - deadCodeReport.ts
        - devProfilePreflight.ts
        - envDoctorCodeActions.ts
        - exportNarrationFile.ts
        - exportNarrationWorkspace.ts
        - exportUtils.ts
        - generateChangeReport.ts
        - generateCodebaseTour.ts
        - governanceSyncNow.ts
        - licenseStatus.ts
        - manageDevices.ts
        - modeState.ts
        - openCommandHelp.ts
        - openModelSettings.ts
        - openToggleControlPanel.ts
        - pgPush.ts
        - pgPushCommitQuality.ts
        - pgPushDeadCodeGate.ts
        - pgPushEnforcementGate.ts
        - pgPushTrustGate.ts
        - pgRootGuidance.ts
        - redeemCode.ts
        - refreshLicense.ts
        - refreshReadingView.ts
        - requestChangePrompt.ts
        - runApiContractValidator.ts
        - runCommandDiagnostics.ts
        - runDbIndexCheck.ts
        - runDeadCodeScan.ts
        - runEnvironmentDoctor.ts
        - runFlowInteractionCheck.ts
        - runMcpCloudScore.ts
        - runObservabilityCheck.ts
        - runTrustWorkspaceScan.ts
        - setNarrationMode.ts
        - setupValidationLibrary.ts
        - showProjectQuota.ts
        - startTrial.ts
        - switchEduDetailLevel.ts
        - switchNarrationMode.ts
        - switchReadingPaneMode.ts
        - switchReadingSnippetMode.ts
        - switchReadingViewMode.ts
        - toggleReadingMode.ts
        - upgradePlan.ts
      - git/
        - diffParser.ts
        - gitClient.ts
        - types.ts
      - governance/
        - decisionSyncWorker.ts
        - postWriteEnforcer.ts
        - powerShellRunner.ts
      - help/
        - commandHelpContent.ts
        - commandHelpStaticSections.ts
        - commandHelpViewProvider.ts
        - commandHelpWorkflowSections.ts
      - licensing/
        - entitlementClient.ts
        - featureGateActions.ts
        - featureGates.ts
        - licensingCallbackHandler.ts
        - plans.ts
        - projectQuota.ts
        - secretStorage.ts
        - tokenVerifier.ts
        - types.ts
      - llm/
        - config.ts
        - openAICompatibleProvider.ts
        - provider.ts
      - narration/
        - narrationEngine.ts
        - outputValidator.ts
        - promptTemplates.ts
        - termMemory.ts
      - readingView/
        - narrateSchemeProvider.ts
        - readingSelectionSyncService.ts
        - renderNarration.ts
        - sectionBuilder.ts
      - startup/
        - startupContextEnforcer.ts
        - startupContextEnforcerStatus.ts
        - startupContextEnforcerSupport.ts
        - startupContextResolver.ts
        - startupEnforcementBridge.ts
      - trust/
        - serverPolicyBridge.ts
        - trustScoreAnalysisUtils.ts
        - trustScoreHelpers.ts
        - trustScoreService.ts
        - trustScoreTypes.ts
        - trustScoreViewProvider.ts
      - ui/
        - toggleControlViewProvider.ts
      - utils/
        - logger.ts
        - logSanitization.ts
        - projectPackageResolver.ts
        - projectValidationResolver.ts
        - repoRootResolver.ts
      - extension.ts
      - types.ts
    - package-lock.json
    - package.json
    - README.md
    - tsconfig.json
  - scripts/
    - agents_integrity.ps1
    - api_contract_verify.ps1
    - build_frontend_summary.py
    - coding_verify.ps1
    - db_index_fix_plan.ps1
    - db_index_maintenance_check.ps1
    - dependency_verify.ps1
    - dev_profile.ps1
    - end_memory_bank_session.ps1
    - end_memory_bank_session.py
    - enforcement_trigger.ps1
    - frontend_integration.ps1
    - generate_memory_bank.py
    - global_pg_cli_template.ps1
    - governance_action_handler.ps1
    - governance_action_playbook.json
    - governance_bind_action.ps1
    - governance_digest.ps1
    - governance_login.ps1
    - governance_worker.ps1
    - install_memory_bank_hooks.ps1
    - install_memory_bank_hooks.sh
    - local_extension_install.ps1
    - map_structure.py
    - map_structure_db.py
    - mcp_cloud_score_verify.ps1
    - memory_bank_guard.py
    - memory_bank_guard_daily.py
    - memory_bank_guard_design.py
    - memory_bank_guard_git.py
    - memory_bank_guard_integration.py
    - memory_bank_guard_milestones.py
    - memory_bank_guard_self_check.py
    - milestone_closure_check.ps1
    - narrate_flow_check.ps1
    - observability_check.ps1
    - pg.ps1
    - pg_lifecycle.ps1
    - pg_prod.ps1
    - playwright_author_suite.ps1
    - playwright_author_suite.py
    - playwright_full_check.ps1
    - playwright_report_summary.py
    - playwright_smoke_check.ps1
    - production_checklist.ps1
    - project_setup.ps1
    - review_workflow.ps1
    - review_workflow_regression_check.ps1
    - reviewer_automation.ps1
    - scaffold_upgrade.ps1
    - scalability_check.ps1
    - self_check.ps1
    - session_status.py
    - setup_cloudflare_tunnel.ps1
    - slack_transport_check.ps1
    - start_memory_bank_session.ps1
    - start_memory_bank_session.py
    - start_memory_bank_session.sh
    - sync_global_pg_cli.ps1
    - tech_debt_check.ps1
  - server/
    - .narrate/
      - stripe-runtime.local.json
    - data/
      - store.json
    - playwright-report/
    - prisma/
      - migrations/
        - 0_init/
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
  - tapSign tapProof-project/
    - Doc-plan/
      - .master_engineering_spec.md
      - complete_build_specification (1).md
      - complete_build_specification (2).md
      - complete_build_specification.md
      - data_isolation_architecture.md
      - device_bound_otp_spec.md
      - device_registration_recovery_spec.md
      - pegasus_resistant_auth_architecture.md
      - physicalotp_signedsend_final_spec.md
      - tapsign-brand-naming-guide.md
      - tapsign-mail-naming-guide.md
      - tapsign-sdk-naming-guide.md
      - zkp_recovery_design (1).md
      - zkp_recovery_design.md
  - AGENTS.md
  - AI_ENFORCEMENT_GUIDE.md
  - ANTIGRAVITY.md
  - building-plan-doc.md
  - CLAUDE.md
  - frontend-screen-spec.md
  - GEMINI.md
  - pg.ps1
  - README.md

## Key Files
| File | Purpose | Notes |
|---|---|---|
| `server/prisma/schema.prisma` | Schema definition | Auto-detected schema artifact |
| `extension/src/readingView/readingSelectionSyncService.ts` | Business/service logic | Auto-detected by filename pattern |
| `extension/src/trust/trustScoreService.ts` | Business/service logic | Auto-detected by filename pattern |
| `server/prisma/migrations/0_init/migration.sql` | DB migration script | Auto-detected migration artifact |
| `server/src/accountRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/adminRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/affiliateRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/authOAuthRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/authRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/enforcementAuditRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/governanceAdminBoardRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/governanceDigestRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/governanceMastermindRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/governanceRoutes.shared.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/governanceRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/governanceSettingsRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/governanceSyncRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/healthRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/integrationOrchestrationRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/mobileReviewerRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/offlinePackRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/paymentsRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/planRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/policyRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/policyVaultRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/productionChecklistRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/reviewOrchestrationRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/reviewerAutomationRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/slackRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/teamRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/src/techDebtRoutes.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/tests/pg-generated/02-routes.generated.spec.ts` | Route or endpoint mapping | Auto-detected by filename pattern |
| `server/.env` | Source/config artifact | Auto-detected |
| `server/.env.example` | Source/config artifact | Auto-detected |
| `README.md` | Source/config artifact | Auto-detected |
| `extension/README.md` | Source/config artifact | Auto-detected |
| `extension/tsconfig.json` | Configuration/spec file | Auto-detected config artifact |
| `server/README.md` | Source/config artifact | Auto-detected |
| `server/tests/pg-generated/README.md` | Source/config artifact | Auto-detected |
| `server/tsconfig.json` | Configuration/spec file | Auto-detected config artifact |
| `extension/src/activation/statusBars.ts` | Source/config artifact | Auto-detected |
| `extension/src/cache/cacheProvider.ts` | Source/config artifact | Auto-detected |
| `extension/src/cache/hashing.ts` | Source/config artifact | Auto-detected |
| `extension/src/cache/jsonCacheProvider.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/activateProjectQuota.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractAnalyzer.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractCodeScan.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractCompare.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractHandoffPrompt.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractOpenApi.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractPath.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractReport.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractSourceScanBackend.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractSourceScanFields.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractSourceScanFrontend.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractSourceScanModel.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractTypedClientScan.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/apiContractTypes.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/applySafeDeadCodeFixes.ts` | Source/config artifact | Auto-detected |
| `extension/src/commands/authSignIn.ts` | Source/config artifact | Auto-detected |
