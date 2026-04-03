import {
  getPublishedAgeInMonths,
  lookupNpmPackage,
  parseLooseSemver
} from "./dependencyVerificationSupport";

export interface DependencyReviewTarget {
  package_name?: string;
  requested_version?: string | null;
  warning_rule_id?: string | null;
  warning_message?: string | null;
}

export interface DependencyReviewRequest {
  package_manager?: "npm";
  targets?: DependencyReviewTarget[];
}

export interface DependencyOfficialSource {
  kind: "npm-registry" | "homepage" | "repository" | "release-notes" | "changelog";
  label: string;
  url: string;
  official: true;
}

export interface DependencyReviewItem {
  package_name: string;
  warning_rule_id: string | null;
  warning_message: string | null;
  status: "review_required" | "hold" | "monitor";
  action: "review-before-upgrade" | "hold-current" | "monitor-package-health";
  requested_version: string | null;
  latest_version: string | null;
  requested_major: number | null;
  latest_major: number | null;
  latest_published_at: string | null;
  latest_release_age_months: number | null;
  summary_message: string;
  policy_note: string;
  official_sources: DependencyOfficialSource[];
  checks: {
    latest_major_is_newer: boolean;
    has_homepage: boolean;
    has_repository: boolean;
    has_release_notes: boolean;
    has_changelog: boolean;
  };
}

export interface DependencyReviewResult {
  ok: true;
  evaluator_version: "dependency-review-v1";
  summary: {
    targets_checked: number;
    review_required: number;
    hold: number;
    monitor: number;
    evaluated_at: string;
  };
  results: DependencyReviewItem[];
}

export async function evaluateDependencyReview(
  requestBody: DependencyReviewRequest
): Promise<DependencyReviewResult> {
  const targets = Array.isArray(requestBody.targets)
    ? requestBody.targets.filter((item) => item?.package_name?.trim())
    : [];
  const results: DependencyReviewItem[] = [];

  for (const target of targets) {
    results.push(await evaluateDependencyReviewTarget(target));
  }

  return {
    ok: true,
    evaluator_version: "dependency-review-v1",
    summary: {
      targets_checked: results.length,
      review_required: results.filter((item) => item.status === "review_required").length,
      hold: results.filter((item) => item.status === "hold").length,
      monitor: results.filter((item) => item.status === "monitor").length,
      evaluated_at: new Date().toISOString()
    },
    results
  };
}

async function evaluateDependencyReviewTarget(
  target: DependencyReviewTarget
): Promise<DependencyReviewItem> {
  const packageName = target.package_name?.trim() ?? "";
  const requestedVersion = target.requested_version?.trim() || null;
  const warningRuleId = target.warning_rule_id?.trim() || null;
  const warningMessage = target.warning_message?.trim() || null;
  const requestedSemver = parseLooseSemver(requestedVersion);
  const lookup = await lookupNpmPackage(packageName);

  if (!lookup.ok) {
    return {
      package_name: packageName,
      warning_rule_id: warningRuleId,
      warning_message: warningMessage,
      status: "hold",
      action: "hold-current",
      requested_version: requestedVersion,
      latest_version: null,
      requested_major: requestedSemver?.major ?? null,
      latest_major: null,
      latest_published_at: null,
      latest_release_age_months: null,
      summary_message: `Official registry verification could not confirm review sources for ${packageName}.`,
      policy_note: "Hold the current version until official vendor release material can be verified.",
      official_sources: [],
      checks: {
        latest_major_is_newer: false,
        has_homepage: false,
        has_repository: false,
        has_release_notes: false,
        has_changelog: false
      }
    };
  }

  const latestSemver = parseLooseSemver(lookup.latestVersion);
  const officialSources = buildOfficialSources(
    lookup.npmPackageUrl,
    lookup.homepageUrl,
    lookup.repositoryUrl
  );
  const checks = {
    latest_major_is_newer: Boolean(
      requestedSemver &&
      latestSemver &&
      latestSemver.major > requestedSemver.major
    ),
    has_homepage: officialSources.some((item) => item.kind === "homepage"),
    has_repository: officialSources.some((item) => item.kind === "repository"),
    has_release_notes: officialSources.some((item) => item.kind === "release-notes"),
    has_changelog: officialSources.some((item) => item.kind === "changelog")
  };
  const ageMonths = getPublishedAgeInMonths(lookup.latestPublishedAt);

  if (checks.latest_major_is_newer) {
    if (!checks.has_repository && !checks.has_homepage) {
      return buildReviewItem(
        target,
        lookup.latestVersion,
        latestSemver?.major ?? null,
        lookup.latestPublishedAt,
        ageMonths,
        officialSources,
        checks,
        "hold",
        "hold-current",
        `Latest major ${latestSemver?.major ?? "unknown"} is newer, but no official homepage or repository source was found for ${packageName}.`,
        "Do not auto-upgrade. Hold the current major until official vendor sources can be verified."
      );
    }
    return buildReviewItem(
      target,
      lookup.latestVersion,
      latestSemver?.major ?? null,
      lookup.latestPublishedAt,
      ageMonths,
      officialSources,
      checks,
      "review_required",
      "review-before-upgrade",
      `Current major ${requestedSemver?.major ?? "unknown"} is behind latest major ${latestSemver?.major ?? "unknown"} for ${packageName}.`,
      "Review official vendor docs, release notes, changelog, and compatibility guidance before proposing or applying a major upgrade."
    );
  }

  return buildReviewItem(
    target,
    lookup.latestVersion,
    latestSemver?.major ?? null,
    lookup.latestPublishedAt,
    ageMonths,
    officialSources,
    checks,
    "monitor",
    "monitor-package-health",
    `No major-version jump is required for ${packageName}; monitor package health and maintainer activity.`,
    "Keep the current version unless an official vendor source shows a required upgrade path."
  );
}

function buildReviewItem(
  target: DependencyReviewTarget,
  latestVersion: string | null,
  latestMajor: number | null,
  latestPublishedAt: string | null,
  latestReleaseAgeMonths: number | null,
  officialSources: DependencyOfficialSource[],
  checks: DependencyReviewItem["checks"],
  status: DependencyReviewItem["status"],
  action: DependencyReviewItem["action"],
  summaryMessage: string,
  policyNote: string
): DependencyReviewItem {
  const requestedVersion = target.requested_version?.trim() || null;
  const requestedSemver = parseLooseSemver(requestedVersion);
  return {
    package_name: target.package_name?.trim() ?? "",
    warning_rule_id: target.warning_rule_id?.trim() || null,
    warning_message: target.warning_message?.trim() || null,
    status,
    action,
    requested_version: requestedVersion,
    latest_version: latestVersion,
    requested_major: requestedSemver?.major ?? null,
    latest_major: latestMajor,
    latest_published_at: latestPublishedAt,
    latest_release_age_months: latestReleaseAgeMonths,
    summary_message: summaryMessage,
    policy_note: policyNote,
    official_sources: officialSources,
    checks
  };
}

function buildOfficialSources(
  npmPackageUrl: string,
  homepageUrl: string | null,
  repositoryUrl: string | null
): DependencyOfficialSource[] {
  const sources: DependencyOfficialSource[] = [];
  pushOfficialSource(sources, "npm-registry", "npm registry", npmPackageUrl);
  pushOfficialSource(sources, "homepage", "homepage", homepageUrl);
  pushOfficialSource(sources, "repository", "repository", repositoryUrl);

  const githubRepoUrl = inferGithubRepositoryUrl(repositoryUrl ?? homepageUrl);
  if (githubRepoUrl) {
    pushOfficialSource(sources, "release-notes", "release notes", `${githubRepoUrl}/releases`);
    pushOfficialSource(sources, "changelog", "changelog", `${githubRepoUrl}/blob/main/CHANGELOG.md`);
  }
  return dedupeSources(sources).slice(0, 5);
}

function pushOfficialSource(
  target: DependencyOfficialSource[],
  kind: DependencyOfficialSource["kind"],
  label: string,
  url: string | null
): void {
  if (!url) {
    return;
  }
  target.push({ kind, label, url, official: true });
}

function inferGithubRepositoryUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  const match = url.match(/^https:\/\/github\.com\/[^/]+\/[^/]+/i);
  return match ? match[0].replace(/\/$/, "") : null;
}

function dedupeSources(
  sources: DependencyOfficialSource[]
): DependencyOfficialSource[] {
  const seen = new Set<string>();
  return sources.filter((item) => {
    const key = `${item.kind}|${item.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
