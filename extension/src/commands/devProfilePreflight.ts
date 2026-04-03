import * as vscode from "vscode";
import { runPowerShellCommand } from "../governance/powerShellRunner";
import { RepoRootResolution } from "../utils/repoRootResolver";

type DevProfileCheckResult = {
  ok?: boolean;
  path?: string;
  missing?: string[];
  message?: string;
  gitignored?: boolean;
};

const CONTINUE_ACTION = "Continue Anyway";
const CANCEL_ACTION = "Cancel";
const INIT_ACTION = "Initialize Dev Profile";

export async function ensureDevProfileReady(
  repo: RepoRootResolution,
  operationLabel: string
): Promise<boolean> {
  const check = await runDevProfileCheck(repo);
  if (check?.ok === true) {
    return true;
  }

  const missingPreview = buildMissingPreview(check?.missing ?? []);
  const baseMessage =
    `Narrate: local dev profile is incomplete before ${operationLabel}. ` +
    "This can cause test/credential retry loops.";
  const detail = missingPreview ? ` Missing: ${missingPreview}.` : "";
  const action = await vscode.window.showWarningMessage(
    `${baseMessage}${detail}`,
    INIT_ACTION,
    CONTINUE_ACTION,
    CANCEL_ACTION
  );

  if (action === INIT_ACTION) {
    const terminal = vscode.window.createTerminal({
      name: "PG Dev Profile Setup",
      cwd: repo.repoRoot
    });
    terminal.show();
    terminal.sendText(".\\pg.ps1 dev-profile -DevProfileAction init");
    terminal.sendText(".\\pg.ps1 dev-profile -DevProfileAction check");
    return false;
  }

  if (action === CONTINUE_ACTION) {
    return true;
  }
  return false;
}

async function runDevProfileCheck(
  repo: RepoRootResolution
): Promise<DevProfileCheckResult | null> {
  const escapedScriptPath = repo.pgScriptPath.replace(/'/g, "''");
  const checkCommand =
    `& '${escapedScriptPath}' dev-profile -DevProfileAction check -Quiet ` +
    "| ConvertTo-Json -Depth 8 -Compress";
  try {
    const result = await runPowerShellCommand(
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        checkCommand
      ],
      repo.repoRoot
    );
    return parseDevProfileResult(result.stdout || result.stderr);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    return parseDevProfileResult(raw);
  }
}

function parseDevProfileResult(raw: string): DevProfileCheckResult | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const firstJson = extractFirstJsonObject(trimmed);
  if (firstJson) {
    try {
      const parsed = JSON.parse(firstJson) as DevProfileCheckResult;
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Fallback below.
    }
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("dev profile check: ok")) {
    return { ok: true };
  }
  if (lower.includes("missing required fields") || lower.includes("profile file not found")) {
    return { ok: false, missing: [] };
  }
  return null;
}

function extractFirstJsonObject(value: string): string | null {
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }
  return value.slice(firstBrace, lastBrace + 1);
}

function buildMissingPreview(missing: string[]): string {
  if (!missing.length) {
    return "";
  }
  const preview = missing.slice(0, 4).join(", ");
  return missing.length > 4 ? `${preview}, ...` : preview;
}

