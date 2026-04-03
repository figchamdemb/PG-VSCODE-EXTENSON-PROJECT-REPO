# Code Tree - auto-extension

LAST_UPDATED_UTC: 2026-03-28 22:31
UPDATED_BY: agent
PROFILE: frontend

## Root Path
- extension

## Tree (Key Paths)
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
        - exports/
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

## Key Files
| File | Purpose | Notes |
|---|---|---|
| `src/readingView/readingSelectionSyncService.ts` | Business/service logic | Auto-detected by filename pattern |
| `src/trust/trustScoreService.ts` | Business/service logic | Auto-detected by filename pattern |
| `README.md` | Source/config artifact | Auto-detected |
| `tsconfig.json` | Configuration/spec file | Auto-detected config artifact |
| `src/activation/statusBars.ts` | Source/config artifact | Auto-detected |
| `src/cache/cacheProvider.ts` | Source/config artifact | Auto-detected |
| `src/cache/hashing.ts` | Source/config artifact | Auto-detected |
| `src/cache/jsonCacheProvider.ts` | Source/config artifact | Auto-detected |
| `src/commands/activateProjectQuota.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractAnalyzer.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractCodeScan.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractCompare.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractHandoffPrompt.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractOpenApi.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractPath.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractReport.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractSourceScanBackend.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractSourceScanFields.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractSourceScanFrontend.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractSourceScanModel.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractTypedClientScan.ts` | Source/config artifact | Auto-detected |
| `src/commands/apiContractTypes.ts` | Source/config artifact | Auto-detected |
| `src/commands/applySafeDeadCodeFixes.ts` | Source/config artifact | Auto-detected |
| `src/commands/authSignIn.ts` | Source/config artifact | Auto-detected |
| `src/commands/authSignInGitHub.ts` | Source/config artifact | Auto-detected |
| `src/commands/codebaseTourGraph.ts` | Source/config artifact | Auto-detected |
| `src/commands/codebaseTourReport.ts` | Source/config artifact | Auto-detected |
| `src/commands/codebaseTourTypes.ts` | Source/config artifact | Auto-detected |
| `src/commands/createDeadCodeCleanupBranch.ts` | Source/config artifact | Auto-detected |
| `src/commands/deadCodeReport.ts` | Source/config artifact | Auto-detected |
| `src/commands/devProfilePreflight.ts` | Source/config artifact | Auto-detected |
| `src/commands/envDoctorCodeActions.ts` | Source/config artifact | Auto-detected |
| `src/commands/exportNarrationFile.ts` | Source/config artifact | Auto-detected |
| `src/commands/exportNarrationWorkspace.ts` | Source/config artifact | Auto-detected |
| `src/commands/exportUtils.ts` | Source/config artifact | Auto-detected |
| `src/commands/generateChangeReport.ts` | Source/config artifact | Auto-detected |
| `src/commands/generateCodebaseTour.ts` | Source/config artifact | Auto-detected |
| `src/commands/governanceSyncNow.ts` | Source/config artifact | Auto-detected |
| `src/commands/licenseStatus.ts` | Source/config artifact | Auto-detected |
| `src/commands/manageDevices.ts` | Source/config artifact | Auto-detected |
| `src/commands/modeState.ts` | Source/config artifact | Auto-detected |
| `src/commands/openCommandHelp.ts` | Source/config artifact | Auto-detected |
| `src/commands/openModelSettings.ts` | Source/config artifact | Auto-detected |
| `src/commands/openToggleControlPanel.ts` | Source/config artifact | Auto-detected |
| `src/commands/pgPush.ts` | Source/config artifact | Auto-detected |
| `src/commands/pgPushCommitQuality.ts` | Source/config artifact | Auto-detected |
| `src/commands/pgPushDeadCodeGate.ts` | Source/config artifact | Auto-detected |
| `src/commands/pgPushEnforcementGate.ts` | Source/config artifact | Auto-detected |
| `src/commands/pgPushTrustGate.ts` | Source/config artifact | Auto-detected |
| `src/commands/pgRootGuidance.ts` | Source/config artifact | Auto-detected |
| `src/commands/redeemCode.ts` | Source/config artifact | Auto-detected |
| `src/commands/refreshLicense.ts` | Source/config artifact | Auto-detected |
| `src/commands/refreshReadingView.ts` | Source/config artifact | Auto-detected |
| `src/commands/requestChangePrompt.ts` | Source/config artifact | Auto-detected |
| `src/commands/runApiContractValidator.ts` | Source/config artifact | Auto-detected |
| `src/commands/runCommandDiagnostics.ts` | Source/config artifact | Auto-detected |
| `src/commands/runDbIndexCheck.ts` | Source/config artifact | Auto-detected |
| `src/commands/runDeadCodeScan.ts` | Source/config artifact | Auto-detected |
| `src/commands/runEnvironmentDoctor.ts` | Source/config artifact | Auto-detected |
| `src/commands/runFlowInteractionCheck.ts` | Source/config artifact | Auto-detected |
