import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export type CommitFileChange = {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
};

type CommitQualityGateMode = "off" | "relaxed" | "strict";

type CommitQualityResult = {
  valid: boolean;
  reasons: string[];
};

export type CommitQualityGateOutcome = {
  message: string;
  mode: CommitQualityGateMode;
  qualityPassed: boolean;
  overridden: boolean;
};

type RepoCommitConventions = {
  types?: string[];
  scopes?: string[];
  additionalGenericRejectWords?: string[];
  ticketPrefix?: string;
};

export async function promptForCommitMessageWithQualityGate(
  changes: CommitFileChange[]
): Promise<CommitQualityGateOutcome | undefined> {
  const config = vscode.workspace.getConfiguration("narrate");
  const gateMode = config.get<CommitQualityGateMode>(
    "commitQuality.pgPushGateMode",
    "relaxed"
  );
  const conventions = loadRepoCommitConventions();
  const suggestions = buildCommitMessageSuggestions(changes, conventions);
  const defaultMessage = suggestions[0] ?? "chore(repo): update project files";

  while (true) {
    const commitMessage = await vscode.window.showInputBox({
      title: "Narrate PG Push",
      prompt:
        "Commit message for git commit." +
        ` Suggestions: 1) ${suggestions[0] ?? "n/a"}  2) ${suggestions[1] ?? "n/a"}`,
      placeHolder: suggestions[0] ?? "type(scope): clear summary",
      value: defaultMessage,
      ignoreFocusOut: true,
      validateInput: (value) => (!value.trim() ? "Commit message is required." : undefined)
    });

    if (!commitMessage) {
      return undefined;
    }

    const quality = evaluateCommitMessageQuality(commitMessage, conventions);
    if (gateMode === "off" || quality.valid) {
      return {
        message: applyTicketPrefix(commitMessage.trim(), conventions),
        mode: gateMode,
        qualityPassed: quality.valid,
        overridden: false
      };
    }

    const nextAction = await pickCommitQualityAction(gateMode, quality.reasons, suggestions);
    if (nextAction === "useSuggestion1" && suggestions[0]) {
      return {
        message: applyTicketPrefix(suggestions[0], conventions),
        mode: gateMode,
        qualityPassed: true,
        overridden: false
      };
    }
    if (nextAction === "useSuggestion2" && suggestions[1]) {
      return {
        message: applyTicketPrefix(suggestions[1], conventions),
        mode: gateMode,
        qualityPassed: true,
        overridden: false
      };
    }
    if (nextAction === "useAnyway" && gateMode === "relaxed") {
      return {
        message: applyTicketPrefix(commitMessage.trim(), conventions),
        mode: gateMode,
        qualityPassed: false,
        overridden: true
      };
    }
    if (nextAction === "cancel") {
      return undefined;
    }
  }
}

function pickCommitQualityActions(
  gateMode: CommitQualityGateMode,
  suggestions: string[]
): string[] {
  const actions = ["Edit Message"];
  if (suggestions[0]) {
    actions.push("Use Suggestion 1");
  }
  if (suggestions[1]) {
    actions.push("Use Suggestion 2");
  }
  actions.push(gateMode === "relaxed" ? "Use Anyway" : "Cancel Push");
  return actions;
}

async function pickCommitQualityAction(
  gateMode: CommitQualityGateMode,
  reasons: string[],
  suggestions: string[]
): Promise<"edit" | "useSuggestion1" | "useSuggestion2" | "useAnyway" | "cancel"> {
  const reasonText = reasons.map((reason) => `- ${reason}`).join("\n");
  const actions = pickCommitQualityActions(gateMode, suggestions);

  const chosen =
    gateMode === "strict"
      ? await vscode.window.showErrorMessage(
          `Narrate Commit Quality Gate blocked this message:\n${reasonText}`,
          ...actions
        )
      : await vscode.window.showWarningMessage(
          `Narrate Commit Quality Gate warnings:\n${reasonText}`,
          ...actions
        );

  if (chosen === "Use Suggestion 1") {
    return "useSuggestion1";
  }
  if (chosen === "Use Suggestion 2") {
    return "useSuggestion2";
  }
  if (chosen === "Use Anyway") {
    return "useAnyway";
  }
  if (chosen === "Cancel Push" || !chosen) {
    return "cancel";
  }
  return "edit";
}

export function parseCommitFileChanges(statusOutput: string): CommitFileChange[] {
  const lines = statusOutput
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.length >= 4);
  const changes: CommitFileChange[] = [];

  for (const line of lines) {
    const indexStatus = line[0] ?? " ";
    const worktreeStatus = line[1] ?? " ";
    const rawPath = line.slice(3).trim();
    const pathPart = rawPath.includes(" -> ")
      ? rawPath.split(" -> ").slice(-1)[0]
      : rawPath;
    if (!pathPart) {
      continue;
    }
    changes.push({
      path: normalizePath(pathPart),
      indexStatus,
      worktreeStatus
    });
  }
  return changes;
}

function buildCommitMessageSuggestions(
  changes: CommitFileChange[],
  conventions: RepoCommitConventions
): string[] {
  const scope = inferCommitScope(changes, conventions.scopes);
  const docsOnly = changes.every((change) => isDocumentationPath(change.path));
  const testsOnly = changes.every((change) => isTestPath(change.path));
  const addedCount = changes.filter((change) => change.indexStatus === "A").length;
  const deletedCount = changes.filter((change) => change.indexStatus === "D").length;

  let primaryType = "fix";
  if (docsOnly) {
    primaryType = "docs";
  } else if (testsOnly) {
    primaryType = "test";
  } else if (addedCount > 0) {
    primaryType = "feat";
  } else if (deletedCount > 0 && addedCount === 0) {
    primaryType = "refactor";
  }

  const primarySummary = inferCommitSummary(changes, primaryType);
  const secondaryType = primaryType === "feat" ? "refactor" : "chore";
  const secondarySummary = inferCommitSummary(changes, secondaryType);

  return [
    `${primaryType}(${scope}): ${primarySummary}`,
    `${secondaryType}(${scope}): ${secondarySummary}`
  ];
}

function inferCommitScope(
  changes: CommitFileChange[],
  conventionScopes?: string[]
): string {
  const frequency = new Map<string, number>();
  for (const change of changes) {
    const segments = normalizePath(change.path).split("/");
    const segment =
      segments.find((item) => !["src", "app", "lib", "server", "extension"].includes(item)) ??
      segments[0] ??
      "repo";
    frequency.set(segment, (frequency.get(segment) ?? 0) + 1);
  }
  const sorted = [...frequency.entries()].sort((left, right) => {
    if (left[1] !== right[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
  const inferred = sanitizeScope(sorted[0]?.[0] ?? "repo");
  if (conventionScopes?.length) {
    const sortedKeys = sorted.map(([seg]) => sanitizeScope(seg));
    const match = conventionScopes.find(
      (s) => s === inferred || sortedKeys.includes(s)
    );
    if (match) {
      return match;
    }
  }
  return inferred;
}

function inferCommitSummary(changes: CommitFileChange[], type: string): string {
  const paths = changes.map((change) => normalizePath(change.path));
  if (paths.some((pathValue) => pathValue.includes("commands/pgPush.ts"))) {
    return "enforce commit quality checks in PG push workflow";
  }
  if (paths.some((pathValue) => pathValue.includes("trust/"))) {
    return "improve trust scoring and diagnostics behavior";
  }
  if (paths.every((pathValue) => isDocumentationPath(pathValue))) {
    return "update project documentation and guidance";
  }
  if (type === "feat") {
    return "add implementation changes for active workflow";
  }
  if (type === "refactor") {
    return "refactor existing implementation for maintainability";
  }
  if (type === "docs") {
    return "update documentation for current changes";
  }
  if (type === "test") {
    return "improve test coverage for updated behavior";
  }
  return "improve implementation reliability and clarity";
}

function evaluateCommitMessageQuality(
  message: string,
  conventions: RepoCommitConventions
): CommitQualityResult {
  const trimmed = message.trim();
  const reasons: string[] = [];
  const config = vscode.workspace.getConfiguration("narrate");
  const minSummaryLength = Math.max(
    5,
    config.get<number>("commitQuality.minSummaryLength", 10)
  );
  const requireConventional = config.get<boolean>(
    "commitQuality.requireConventional",
    true
  );
  const rejectGeneric = config.get<boolean>(
    "commitQuality.rejectGenericMessages",
    true
  );

  if (rejectGeneric && isGenericCommitMessage(trimmed, conventions.additionalGenericRejectWords)) {
    reasons.push("Generic commit messages are blocked (for example: fix, update, wip).");
  }
  if (requireConventional) {
    const validTypes = conventions.types?.length
      ? conventions.types.join("|")
      : "feat|fix|refactor|docs|test|chore|perf|build|ci";
    const conventionalPattern = new RegExp(
      `^(${validTypes})(\\([a-z0-9._/-]+\\))?!?:\\s+.+$`,
      "u"
    );
    if (!conventionalPattern.test(trimmed)) {
      reasons.push("Use conventional commit format: type(scope): summary.");
    }
  }

  const summary = extractCommitSummary(trimmed);
  if (summary.length < minSummaryLength) {
    reasons.push(`Summary must be at least ${minSummaryLength} characters.`);
  }
  if (/^\d+$/u.test(summary)) {
    reasons.push("Summary cannot be only a ticket number.");
  }

  return { valid: reasons.length === 0, reasons };
}

const GENERIC_COMMIT_WORDS = new Set([
  "fix", "update", "wip", "stuff", "temp", "asdf",
  "test", "commit", "changes", "misc", "small fix"
]);

function isGenericCommitMessage(value: string, additionalWords?: string[]): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z0-9\s:-]/gu, "").trim();
  const genericValues = new Set(GENERIC_COMMIT_WORDS);
  if (additionalWords) {
    for (const word of additionalWords) genericValues.add(word.toLowerCase());
  }
  if (genericValues.has(normalized)) return true;
  return normalized.split(/\s+/u).length <= 2 && genericValues.has(normalized.split(":").pop() ?? "");
}

function extractCommitSummary(message: string): string {
  const colonIndex = message.indexOf(":");
  if (colonIndex >= 0 && colonIndex < message.length - 1) {
    return message.slice(colonIndex + 1).trim();
  }
  return message.trim();
}

function sanitizeScope(scope: string): string {
  const normalized = scope.toLowerCase().replace(/[^a-z0-9._/-]/gu, "-");
  return normalized.replace(/-+/gu, "-").replace(/^-|-$/gu, "") || "repo";
}

function isDocumentationPath(pathValue: string): boolean {
  const normalized = normalizePath(pathValue).toLowerCase();
  return (
    normalized.endsWith(".md") ||
    normalized.endsWith(".mdx") ||
    normalized.includes("/docs/") ||
    normalized.includes("memory-bank/")
  );
}

function isTestPath(pathValue: string): boolean {
  const normalized = normalizePath(pathValue).toLowerCase();
  return (
    normalized.includes("/__tests__/") ||
    normalized.includes("/tests/") ||
    normalized.includes(".test.") ||
    normalized.includes(".spec.")
  );
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function loadRepoCommitConventions(): RepoCommitConventions {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    return {};
  }
  const conventionsPath = path.join(
    workspace.uri.fsPath,
    ".narrate",
    "commit-conventions.json"
  );
  try {
    if (!fs.existsSync(conventionsPath)) {
      return {};
    }
    const raw = fs.readFileSync(conventionsPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return validateRepoConventions(parsed);
  } catch {
    return {};
  }
}

function validateRepoConventions(raw: Record<string, unknown>): RepoCommitConventions {
  const result: RepoCommitConventions = {};
  if (Array.isArray(raw["types"]) && raw["types"].every((v) => typeof v === "string")) {
    result.types = raw["types"] as string[];
  }
  if (Array.isArray(raw["scopes"]) && raw["scopes"].every((v) => typeof v === "string")) {
    result.scopes = raw["scopes"] as string[];
  }
  if (
    Array.isArray(raw["additionalGenericRejectWords"]) &&
    raw["additionalGenericRejectWords"].every((v) => typeof v === "string")
  ) {
    result.additionalGenericRejectWords = raw["additionalGenericRejectWords"] as string[];
  }
  if (typeof raw["ticketPrefix"] === "string") {
    result.ticketPrefix = raw["ticketPrefix"];
  }
  return result;
}

function applyTicketPrefix(message: string, conventions: RepoCommitConventions): string {
  if (!conventions.ticketPrefix) {
    return message;
  }
  const prefix = conventions.ticketPrefix.trim();
  if (!prefix || message.includes(prefix)) {
    return message;
  }
  const colonIndex = message.indexOf(":");
  if (colonIndex < 0) {
    return `${prefix} ${message}`;
  }
  const beforeColon = message.slice(0, colonIndex + 1);
  const afterColon = message.slice(colonIndex + 1).trimStart();
  return `${beforeColon} ${prefix} ${afterColon}`;
}
