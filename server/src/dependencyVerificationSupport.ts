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
  homepage?: string;
  repository?: string | { url?: string };
};

type NpmRegistryResponse = {
  "dist-tags"?: {
    latest?: string;
  };
  versions?: Record<string, NpmRegistryPackageVersion>;
  time?: Record<string, string>;
  homepage?: string;
  repository?: string | { url?: string };
};

type NpmLookupResult =
  | {
      ok: true;
      latestVersion: string;
      latestPublishedAt: string | null;
      deprecatedMessage: string | null;
      homepageUrl: string | null;
      repositoryUrl: string | null;
      npmPackageUrl: string;
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
const REGISTRY_TIMEOUT_MS = 12000;
const REGISTRY_MAX_ATTEMPTS = 4;
const REGISTRY_RETRY_BASE_DELAY_MS = 500;
const REGISTRY_RETRY_MAX_DELAY_MS = 4000;
const REGISTRY_RETRY_JITTER_MS = 300;

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
  let lastFailureMessage = `npm lookup failed for ${packageName}.`;

  for (let attempt = 1; attempt <= REGISTRY_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT_MS);
    try {
      const data = await fetchNpmRegistryMetadata(url, packageName, controller.signal);
      if (!data) {
        return {
          ok: false,
          error: `npm metadata for ${packageName} did not provide dist-tags.latest.`
        };
      }
      return data;
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      const retryable = isRetryableNpmLookupError(error);
      lastFailureMessage = `npm lookup failed for ${packageName}: ${errorMessage}`;
      if (!retryable || attempt >= REGISTRY_MAX_ATTEMPTS) {
        break;
      }
      await sleep(computeRetryDelayMs(attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    error: `${lastFailureMessage} (attempts=${REGISTRY_MAX_ATTEMPTS})`
  };
}

async function fetchNpmRegistryMetadata(
  url: string,
  packageName: string,
  signal: AbortSignal
): Promise<NpmLookupResult | null> {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    signal
  });
  if (!response.ok) {
    if (isRetryableRegistryStatus(response.status)) {
      throw new Error(`npm registry transient status ${response.status} for ${packageName}.`);
    }
    return { ok: false, error: `npm registry returned ${response.status} for ${packageName}.` };
  }
  return parseNpmRegistryLookupResponse(await response.json() as NpmRegistryResponse, packageName);
}

function isRetryableRegistryStatus(statusCode: number): boolean {
  return statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504;
}

function isRetryableNpmLookupError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }
    const message = error.message.toLowerCase();
    if (
      message.includes("aborted") ||
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("econnreset") ||
      message.includes("eai_again") ||
      message.includes("socket hang up") ||
      message.includes("transient status")
    ) {
      return true;
    }
  }
  return false;
}

function computeRetryDelayMs(attempt: number): number {
  const exponentialDelay = REGISTRY_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1));
  const cappedDelay = Math.min(exponentialDelay, REGISTRY_RETRY_MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * REGISTRY_RETRY_JITTER_MS);
  return cappedDelay + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNpmRegistryLookupResponse(
  data: NpmRegistryResponse,
  packageName: string
): NpmLookupResult | null {
  const latestVersion = data["dist-tags"]?.latest;
  if (!latestVersion) {
    return null;
  }
  const versionMeta = data.versions?.[latestVersion];
  const latestPublishedAt = data.time?.[latestVersion] ?? data.time?.modified ?? null;
  return {
    ok: true,
    latestVersion,
    latestPublishedAt,
    deprecatedMessage: versionMeta?.deprecated ?? null,
    homepageUrl: normalizeHttpUrl(data.homepage ?? versionMeta?.homepage ?? null),
    repositoryUrl: normalizeRepositoryUrl(data.repository ?? versionMeta?.repository ?? null),
    npmPackageUrl: buildNpmPackageUrl(packageName)
  };
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

function buildNpmPackageUrl(packageName: string): string {
  return `https://www.npmjs.com/package/${encodeURIComponent(packageName)}`;
}

function normalizeRepositoryUrl(
  input: string | { url?: string } | null | undefined
): string | null {
  if (!input) {
    return null;
  }
  const raw = typeof input === "string" ? input : input.url ?? "";
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim()
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
  return normalizeHttpUrl(trimmed);
}

function normalizeHttpUrl(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  return trimmed;
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
