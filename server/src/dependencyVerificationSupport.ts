import type {
  DependencyCandidateInput,
  DependencyVerificationViolation
} from "./dependencyVerificationContracts";

export type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

export type NormalizedDependency = {
  name: string;
  requestedVersion: string | null;
  vulnerabilityMaxSeverity: string | null;
};

type NpmRegistryPackageVersion = {
  deprecated?: string;
};

type NpmRegistryResponse = {
  "dist-tags"?: {
    latest?: string;
  };
  versions?: Record<string, NpmRegistryPackageVersion>;
  time?: Record<string, string>;
};

type NpmLookupResult =
  | {
      ok: true;
      latestVersion: string;
      latestPublishedAt: string | null;
      deprecatedMessage: string | null;
    }
  | {
      ok: false;
      error: string;
    };

type DenyListEntry = {
  replacement: string;
  reason: string;
};

const NPM_REGISTRY_BASE = "https://registry.npmjs.org";
const REGISTRY_TIMEOUT_MS = 4000;

const DENY_LIST: Record<string, DenyListEntry> = {
  "react-query": {
    replacement: "@tanstack/react-query",
    reason: "Renamed and old package is deprecated."
  },
  "create-react-app": {
    replacement: "vite or next",
    reason: "Create React App is deprecated by the React team."
  },
  "react-scripts": {
    replacement: "vite or next",
    reason: "react-scripts belongs to deprecated CRA workflow."
  },
  moment: {
    replacement: "date-fns or dayjs",
    reason: "moment is in maintenance mode and increases bundle size."
  },
  request: {
    replacement: "fetch (native) or axios",
    reason: "request is deprecated."
  },
  "node-sass": {
    replacement: "sass",
    reason: "node-sass is deprecated in favor of dart-sass."
  },
  tslint: {
    replacement: "eslint + @typescript-eslint",
    reason: "TSLint is deprecated."
  },
  enzyme: {
    replacement: "@testing-library/react",
    reason: "enzyme maintenance for modern React is stale."
  },
  bull: {
    replacement: "bullmq",
    reason: "bullmq is the maintained successor."
  },
  faker: {
    replacement: "@faker-js/faker",
    reason: "Original faker package is not the maintained source."
  },
  "react-redux-form": {
    replacement: "react-hook-form",
    reason: "react-redux-form is no longer actively maintained."
  }
};

const NATIVE_ALTERNATIVE_HINTS: Record<string, string> = {
  "body-parser": "Use express.json()/express.urlencoded() built into Express.",
  "node-fetch": "Use native fetch in Node 18+.",
  uuid: "Use crypto.randomUUID in Node 18+ when possible.",
  dotenv: "Next.js and several frameworks load .env natively."
};

export function normalizeDependencies(
  input: DependencyCandidateInput[] | undefined
): NormalizedDependency[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const normalized: NormalizedDependency[] = [];
  for (const item of input) {
    const name = item?.name?.trim();
    if (!name) {
      continue;
    }
    normalized.push({
      name,
      requestedVersion: item.requested_version?.trim() ?? null,
      vulnerabilityMaxSeverity: item.vulnerability_max_severity ?? null
    });
  }
  return normalized;
}

export function normalizeFramework(framework: string | undefined): string {
  return (framework ?? "unknown").trim().toLowerCase();
}

export function pushViolation(
  target: DependencyVerificationViolation[],
  violation: DependencyVerificationViolation
): void {
  target.push(violation);
}

export function normalizeSeverity(
  value: string | null
): "critical" | "high" | "medium" | "low" | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "critical" ||
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low"
  ) {
    return normalized;
  }
  return null;
}

export function findDenyEntry(packageName: string): { replacement: string; reason: string } | null {
  return DENY_LIST[packageName] ?? null;
}

export function resolveNativeAlternativeHint(
  packageName: string,
  nodeRuntime: ParsedSemver | null,
  framework: string
): string | null {
  if (packageName === "node-fetch" && nodeRuntime && nodeRuntime.major >= 18) {
    return NATIVE_ALTERNATIVE_HINTS["node-fetch"];
  }
  if (packageName === "uuid" && nodeRuntime && nodeRuntime.major >= 18) {
    return NATIVE_ALTERNATIVE_HINTS.uuid;
  }
  if (packageName === "dotenv" && (framework === "nextjs" || framework === "nestjs")) {
    return NATIVE_ALTERNATIVE_HINTS.dotenv;
  }
  if (packageName === "body-parser") {
    return NATIVE_ALTERNATIVE_HINTS["body-parser"];
  }
  return null;
}

export function isPinnedVersionRange(version: string): boolean {
  const normalized = version.trim();
  if (!normalized || normalized === "latest" || normalized === "*" || normalized.includes("||")) {
    return false;
  }
  return /^(\^|~)?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(normalized);
}

export function parseLooseSemver(input: string | null): ParsedSemver | null {
  if (!input) {
    return null;
  }
  const trimmed = input.trim();
  const match = trimmed.match(/(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null
  };
}

export async function lookupNpmPackage(packageName: string): Promise<NpmLookupResult> {
  const url = buildNpmRegistryUrl(packageName);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `npm registry returned ${response.status} for ${packageName}.`
      };
    }
    const data = (await response.json()) as NpmRegistryResponse;
    const latestVersion = data["dist-tags"]?.latest;
    if (!latestVersion) {
      return {
        ok: false,
        error: `npm metadata for ${packageName} did not provide dist-tags.latest.`
      };
    }

    const versionMeta = data.versions?.[latestVersion];
    const latestPublishedAt = data.time?.[latestVersion] ?? data.time?.modified ?? null;
    return {
      ok: true,
      latestVersion,
      latestPublishedAt,
      deprecatedMessage: versionMeta?.deprecated ?? null
    };
  } catch (error) {
    return {
      ok: false,
      error: `npm lookup failed for ${packageName}: ${toErrorMessage(error)}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildNpmRegistryUrl(packageName: string): string {
  if (packageName.startsWith("@")) {
    const [scope, scopedName] = packageName.split("/");
    if (!scope || !scopedName) {
      return `${NPM_REGISTRY_BASE}/${encodeURIComponent(packageName)}`;
    }
    return `${NPM_REGISTRY_BASE}/${encodeURIComponent(scope)}/${encodeURIComponent(scopedName)}`;
  }
  return `${NPM_REGISTRY_BASE}/${encodeURIComponent(packageName)}`;
}

export function getPublishedAgeInMonths(isoDate: string | null): number | null {
  if (!isoDate) {
    return null;
  }
  const published = new Date(isoDate);
  if (Number.isNaN(published.getTime())) {
    return null;
  }
  const now = new Date();
  const years = now.getUTCFullYear() - published.getUTCFullYear();
  const months = now.getUTCMonth() - published.getUTCMonth();
  const total = years * 12 + months;
  return total < 0 ? 0 : total;
}

export function normalizeVersionForEquality(input: string): string | null {
  const match = input.trim().match(/(\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?)/);
  return match ? match[1] : null;
}

export function isTypeDefinitionPackage(packageName: string): boolean {
  return packageName.startsWith("@types/");
}

export function findDependency(
  dependencies: Array<{ name: string; requestedVersion: string | null }>,
  name: string
): { name: string; requestedVersion: string | null } | null {
  return dependencies.find((item) => item.name === name) ?? null;
}

export function isNodeAtLeast(
  version: ParsedSemver,
  minimumMajor: number,
  minimumMinor: number
): boolean {
  if (version.major > minimumMajor) {
    return true;
  }
  if (version.major < minimumMajor) {
    return false;
  }
  return version.minor >= minimumMinor;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
