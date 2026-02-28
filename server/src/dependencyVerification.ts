import type {
  DependencyVerificationRequest,
  DependencyVerificationResult,
  DependencyVerificationViolation
} from "./dependencyVerificationContracts";
import {
  findDependency,
  findDenyEntry,
  getPublishedAgeInMonths,
  isNodeAtLeast,
  isPinnedVersionRange,
  isTypeDefinitionPackage,
  lookupNpmPackage,
  normalizeDependencies,
  normalizeFramework,
  normalizeSeverity,
  normalizeVersionForEquality,
  parseLooseSemver,
  pushViolation,
  resolveNativeAlternativeHint,
  type NormalizedDependency,
  type ParsedSemver
} from "./dependencyVerificationSupport";

export type {
  DependencyCandidateInput,
  DependencyVerificationRequest,
  DependencyVerificationResult,
  DependencyVerificationViolation,
  VerificationSeverity
} from "./dependencyVerificationContracts";

const STALE_WARNING_MONTHS = 12;
const STALE_BLOCK_MONTHS = 24;

export async function evaluateDependencyVerification(
  requestBody: DependencyVerificationRequest
): Promise<DependencyVerificationResult> {
  const blockers: DependencyVerificationViolation[] = [];
  const warnings: DependencyVerificationViolation[] = [];
  const dependencies = normalizeDependencies(requestBody.dependencies);
  const nodeRuntime = parseLooseSemver(requestBody.runtime?.node_version ?? null);
  const framework = normalizeFramework(requestBody.project_framework);
  const skipRegistryFetch = requestBody.options?.skip_registry_fetch === true;
  const allowPrerelease = requestBody.options?.allow_prerelease === true;
  let registryLookupFailures = 0;

  if ((requestBody.package_manager ?? "npm") !== "npm") {
    pushViolation(blockers, {
      rule_id: "DEP-INPUT-001",
      severity: "blocker",
      package_name: null,
      message: "Only npm package manager is supported in dependency-verification-v1.",
      hint: "Use package_manager=npm for this baseline implementation."
    });
  }

  if (dependencies.length === 0) {
    pushViolation(blockers, {
      rule_id: "DEP-INPUT-002",
      severity: "blocker",
      package_name: null,
      message: "No dependencies were provided for verification.",
      hint: "Pass package.json dependency entries to the verifier."
    });
  }

  for (const dependency of dependencies) {
    const packageName = dependency.name;
    const normalizedName = packageName.toLowerCase();
    const requestedVersion = (dependency.requestedVersion ?? "").trim();
    const denyEntry = findDenyEntry(normalizedName);

    if (denyEntry) {
      pushViolation(blockers, {
        rule_id: "DEP-DENY-001",
        severity: "blocker",
        package_name: packageName,
        message: `Package ${packageName} is on the deny list.`,
        hint: `Use ${denyEntry.replacement}. Reason: ${denyEntry.reason}`
      });
      continue;
    }

    const nativeHint = resolveNativeAlternativeHint(normalizedName, nodeRuntime, framework);
    if (nativeHint) {
      pushViolation(blockers, {
        rule_id: "DEP-NATIVE-001",
        severity: "blocker",
        package_name: packageName,
        message: `Package ${packageName} duplicates native framework/runtime functionality.`,
        hint: nativeHint
      });
      continue;
    }

    if (!isPinnedVersionRange(requestedVersion)) {
      pushViolation(blockers, {
        rule_id: "DEP-VERSION-001",
        severity: "blocker",
        package_name: packageName,
        message: `Requested version "${requestedVersion || "(empty)"}" is not pinned.`,
        hint: "Use exact or caret range only (example: ^5.2.0)."
      });
      continue;
    }

    const requestedSemver = parseLooseSemver(requestedVersion);
    if (!requestedSemver) {
      pushViolation(blockers, {
        rule_id: "DEP-VERSION-002",
        severity: "blocker",
        package_name: packageName,
        message: `Could not parse semver from "${requestedVersion}".`,
        hint: "Use x.y.z with optional ^ or ~ prefix."
      });
      continue;
    }

    if (requestedSemver.prerelease && !allowPrerelease) {
      pushViolation(blockers, {
        rule_id: "DEP-VERSION-003",
        severity: "blocker",
        package_name: packageName,
        message: `Pre-release version "${requestedVersion}" is not allowed.`,
        hint: "Use latest stable version unless explicitly approved."
      });
      continue;
    }

    const severity = normalizeSeverity(dependency.vulnerabilityMaxSeverity);
    if (severity === "critical" || severity === "high") {
      pushViolation(blockers, {
        rule_id: "DEP-SEC-001",
        severity: "blocker",
        package_name: packageName,
        message: `Known vulnerability severity for ${packageName} is ${severity}.`,
        hint: "Upgrade or replace package before proceeding."
      });
      continue;
    }
    if (severity === "medium") {
      pushViolation(warnings, {
        rule_id: "DEP-SEC-002",
        severity: "warning",
        package_name: packageName,
        message: `Known vulnerability severity for ${packageName} is medium.`,
        hint: "Schedule upgrade and security recheck before production cut."
      });
    }

    if (skipRegistryFetch) {
      continue;
    }

    const lookup = await lookupNpmPackage(packageName);
    if (!lookup.ok) {
      registryLookupFailures += 1;
      pushViolation(blockers, {
        rule_id: "DEP-REGISTRY-001",
        severity: "blocker",
        package_name: packageName,
        message: `Official npm registry verification failed for ${packageName}.`,
        hint: lookup.error
      });
      continue;
    }

    if (lookup.deprecatedMessage) {
      pushViolation(blockers, {
        rule_id: "DEP-REGISTRY-002",
        severity: "blocker",
        package_name: packageName,
        message: `Package ${packageName} is deprecated on npm.`,
        hint: lookup.deprecatedMessage
      });
      continue;
    }

    const latestSemver = parseLooseSemver(lookup.latestVersion);
    if (latestSemver && requestedSemver.major < latestSemver.major) {
      pushViolation(warnings, {
        rule_id: "DEP-FRESHNESS-001",
        severity: "warning",
        package_name: packageName,
        message: `Requested major (${requestedSemver.major}) is behind latest major (${latestSemver.major}).`,
        hint: `Review upgrade path to ${lookup.latestVersion}.`
      });
    }

    const ageInMonths = getPublishedAgeInMonths(lookup.latestPublishedAt);
    if (ageInMonths !== null && ageInMonths > STALE_BLOCK_MONTHS) {
      if (isTypeDefinitionPackage(normalizedName)) {
        pushViolation(warnings, {
          rule_id: "DEP-MAINT-003",
          severity: "warning",
          package_name: packageName,
          message: `Type definition package ${packageName} appears stale (last publish about ${ageInMonths} months ago).`,
          hint: "Type packages are allowed as warning; verify runtime package health and lockfile integrity."
        });
        continue;
      }
      pushViolation(blockers, {
        rule_id: "DEP-MAINT-001",
        severity: "blocker",
        package_name: packageName,
        message: `Package ${packageName} appears stale (last publish about ${ageInMonths} months ago).`,
        hint: "Choose an actively maintained alternative."
      });
      continue;
    }
    if (ageInMonths !== null && ageInMonths > STALE_WARNING_MONTHS) {
      pushViolation(warnings, {
        rule_id: "DEP-MAINT-002",
        severity: "warning",
        package_name: packageName,
        message: `Package ${packageName} has no recent updates (about ${ageInMonths} months).`,
        hint: "Check maintainer activity and issue tracker before adoption."
      });
    }
  }

  runCompatibilityChecks({
    dependencies,
    nodeRuntime,
    framework,
    blockers,
    warnings
  });

  return {
    ok: blockers.length === 0,
    status: blockers.length === 0 ? "pass" : "blocked",
    evaluator_version: "dependency-verification-v1",
    summary: {
      checked_dependencies: dependencies.length,
      blockers: blockers.length,
      warnings: warnings.length,
      registry_lookup_failures: registryLookupFailures,
      evaluated_at: new Date().toISOString()
    },
    blockers,
    warnings
  };
}

function runCompatibilityChecks(input: {
  dependencies: NormalizedDependency[];
  nodeRuntime: ParsedSemver | null;
  framework: string;
  blockers: DependencyVerificationViolation[];
  warnings: DependencyVerificationViolation[];
}): void {
  const nextDep = findDependency(input.dependencies, "next");
  const reactDep = findDependency(input.dependencies, "react");
  const prismaCli = findDependency(input.dependencies, "prisma");
  const prismaClient = findDependency(input.dependencies, "@prisma/client");

  checkNextCompatibility(nextDep, reactDep, input.nodeRuntime, input.blockers);
  checkNestCompatibility(input.dependencies, input.blockers);
  checkPrismaVersionSync(prismaCli, prismaClient, input.blockers);

  if (input.framework === "nextjs" && !nextDep) {
    pushViolation(input.warnings, {
      rule_id: "DEP-COMP-101",
      severity: "warning",
      package_name: null,
      message: "project_framework=nextjs but dependency list does not include next.",
      hint: "Verify manifest source if this project is expected to be Next.js."
    });
  }
}

function checkNextCompatibility(
  nextDep: { name: string; requestedVersion: string | null } | null,
  reactDep: { name: string; requestedVersion: string | null } | null,
  nodeRuntime: ParsedSemver | null,
  blockers: DependencyVerificationViolation[]
): void {
  if (!nextDep || !nextDep.requestedVersion) {
    return;
  }
  const nextVersion = parseLooseSemver(nextDep.requestedVersion);
  if (!nextVersion) {
    return;
  }

  if (nextVersion.major >= 15) {
    if (!reactDep || !reactDep.requestedVersion) {
      pushViolation(blockers, {
        rule_id: "DEP-COMP-001",
        severity: "blocker",
        package_name: "next",
        message: "Next.js 15+ requires React dependency to be present.",
        hint: "Add react@^19.0.0 and react-dom@^19.0.0."
      });
      return;
    }
    const reactVersion = parseLooseSemver(reactDep.requestedVersion);
    if (!reactVersion || reactVersion.major < 19) {
      pushViolation(blockers, {
        rule_id: "DEP-COMP-002",
        severity: "blocker",
        package_name: "react",
        message: "Next.js 15+ requires React 19.",
        hint: "Upgrade react/react-dom to 19.x."
      });
    }
    if (!nodeRuntime || !isNodeAtLeast(nodeRuntime, 18, 18)) {
      pushViolation(blockers, {
        rule_id: "DEP-COMP-003",
        severity: "blocker",
        package_name: "next",
        message: "Next.js 15+ requires Node 18.18+ runtime.",
        hint: "Provide runtime.node_version and upgrade Node if below 18.18."
      });
    }
    return;
  }

  if (nextVersion.major === 14) {
    if (!reactDep || !reactDep.requestedVersion) {
      pushViolation(blockers, {
        rule_id: "DEP-COMP-004",
        severity: "blocker",
        package_name: "next",
        message: "Next.js 14 requires React dependency to be present.",
        hint: "Add react@^18.0.0 and react-dom@^18.0.0."
      });
      return;
    }
    const reactVersion = parseLooseSemver(reactDep.requestedVersion);
    if (!reactVersion || reactVersion.major < 18) {
      pushViolation(blockers, {
        rule_id: "DEP-COMP-005",
        severity: "blocker",
        package_name: "react",
        message: "Next.js 14 requires React 18+.",
        hint: "Upgrade react/react-dom to 18.x or 19.x."
      });
    }
    if (!nodeRuntime || !isNodeAtLeast(nodeRuntime, 18, 17)) {
      pushViolation(blockers, {
        rule_id: "DEP-COMP-006",
        severity: "blocker",
        package_name: "next",
        message: "Next.js 14 requires Node 18.17+ runtime.",
        hint: "Provide runtime.node_version and upgrade Node if below 18.17."
      });
    }
  }
}

function checkNestCompatibility(
  dependencies: NormalizedDependency[],
  blockers: DependencyVerificationViolation[]
): void {
  const nestDeps = dependencies.filter((item) => item.name.startsWith("@nestjs/"));
  if (nestDeps.length <= 1) {
    return;
  }
  const majors = new Set<number>();
  for (const dep of nestDeps) {
    const parsed = parseLooseSemver(dep.requestedVersion);
    if (parsed) {
      majors.add(parsed.major);
    }
  }
  if (majors.size > 1) {
    pushViolation(blockers, {
      rule_id: "DEP-COMP-010",
      severity: "blocker",
      package_name: "@nestjs/*",
      message: "All @nestjs packages must use the same major version.",
      hint: "Align every @nestjs/* dependency to one major version."
    });
  }
}

function checkPrismaVersionSync(
  prismaCli: { name: string; requestedVersion: string | null } | null,
  prismaClient: { name: string; requestedVersion: string | null } | null,
  blockers: DependencyVerificationViolation[]
): void {
  if (!prismaCli || !prismaClient || !prismaCli.requestedVersion || !prismaClient.requestedVersion) {
    return;
  }
  const normalizedCli = normalizeVersionForEquality(prismaCli.requestedVersion);
  const normalizedClient = normalizeVersionForEquality(prismaClient.requestedVersion);
  if (!normalizedCli || !normalizedClient) {
    return;
  }
  if (normalizedCli !== normalizedClient) {
    pushViolation(blockers, {
      rule_id: "DEP-COMP-020",
      severity: "blocker",
      package_name: "prisma/@prisma/client",
      message: "prisma CLI version must exactly match @prisma/client version.",
      hint: `Set both packages to the same version (current: prisma=${normalizedCli}, @prisma/client=${normalizedClient}).`
    });
  }
}
