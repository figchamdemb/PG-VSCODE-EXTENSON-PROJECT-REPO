// Observability adapter health check — extension command + rollout pack presets + report
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { runPowerShellCommand } from "../governance/powerShellRunner";
import { RepoRootResolution, resolveRepoRoot } from "../utils/repoRootResolver";
import { Logger } from "../utils/logger";
import { showPgRootGuidance } from "./pgRootGuidance";
import { ensureDevProfileReady } from "./devProfilePreflight";

// ── Types ────────────────────────────────────────────────────────────

type FindingSeverity = "blocker" | "warning";
type ObservabilityAdapter = "otlp" | "sentry" | "signoz";
type DeploymentProfile = "pg-hosted" | "customer-hosted" | "hybrid";

interface ObservabilityFinding {
  rule_id: string;
  severity: FindingSeverity;
  adapter: string;
  source: string;
  message: string;
  hint: string;
}

interface AdapterStatus {
  adapter: ObservabilityAdapter;
  readiness: "disabled" | "ready" | "misconfigured";
  hosted_by: string;
}

interface ObservabilityResult {
  ok: boolean;
  status: "pass" | "blocked";
  evaluator_version: string;
  deployment_profile: DeploymentProfile;
  adapters: AdapterStatus[];
  summary: {
    adapters_enabled: number;
    adapters_ready: number;
    blockers: number;
    warnings: number;
    evaluated_at: string;
  };
  findings: ObservabilityFinding[];
}

// ── Rollout pack presets ─────────────────────────────────────────────

interface RolloutPackPreset {
  label: string;
  description: string;
  deploymentProfile: DeploymentProfile;
  otlpEnabled: boolean;
  sentryEnabled: boolean;
  signozEnabled: boolean;
  otlpHostedBy: string;
  sentryHostedBy: string;
  signozHostedBy: string;
}

const ROLLOUT_PACKS: Record<string, RolloutPackPreset> = {
  "pg-default": {
    label: "PG-Hosted Default",
    description: "OTLP + Sentry via PG-hosted infrastructure (recommended start)",
    deploymentProfile: "pg-hosted",
    otlpEnabled: true, sentryEnabled: true, signozEnabled: false,
    otlpHostedBy: "pg", sentryHostedBy: "pg", signozHostedBy: "unknown"
  },
  "enterprise-byoc": {
    label: "Enterprise BYOC",
    description: "Bring-your-own-cloud: all adapters customer-hosted",
    deploymentProfile: "customer-hosted",
    otlpEnabled: true, sentryEnabled: true, signozEnabled: true,
    otlpHostedBy: "customer", sentryHostedBy: "customer", signozHostedBy: "customer"
  },
  "hybrid": {
    label: "Hybrid",
    description: "OTLP via PG, Sentry/SigNoz customer-hosted",
    deploymentProfile: "hybrid",
    otlpEnabled: true, sentryEnabled: true, signozEnabled: true,
    otlpHostedBy: "pg", sentryHostedBy: "customer", signozHostedBy: "customer"
  },
  "minimal": {
    label: "Minimal",
    description: "OTLP-only via PG infrastructure",
    deploymentProfile: "pg-hosted",
    otlpEnabled: true, sentryEnabled: false, signozEnabled: false,
    otlpHostedBy: "pg", sentryHostedBy: "unknown", signozHostedBy: "unknown"
  }
};

// ── Constants ────────────────────────────────────────────────────────

const REPORT_FILE = "observability-check-latest.md";
const GENERATED_DIR = "Memory-bank/_generated";

// ── Public API ───────────────────────────────────────────────────────

export function registerRunObservabilityCheckCommand(
  logger: Logger
): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.runObservabilityCheck", async () => {
    try {
      await runObservabilityCheck(logger);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Narrate: Observability check failed. ${msg}`);
    }
  });
}

// ── Main flow ────────────────────────────────────────────────────────

async function runObservabilityCheck(logger: Logger): Promise<void> {
  const repo = resolveRepoRoot();
  if (!repo) { await showPgRootGuidance("observability check"); return; }
  const canContinue = await ensureDevProfileReady(repo, "observability check");
  if (!canContinue) { return; }
  const scriptPath = path.join(repo.repoRoot, "scripts", "observability_check.ps1");
  if (!fs.existsSync(scriptPath)) { vscode.window.showWarningMessage("Narrate: observability_check.ps1 not found."); return; }
  const packKey = await pickRolloutPack();
  if (!packKey) return;
  const pack = ROLLOUT_PACKS[packKey];
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Narrate: Running observability check [${pack.label}]…`, cancellable: false },
    async () => executeObservabilityCheck(repo, scriptPath, pack, logger)
  );
  writeObservabilityReport(result, pack, repo);
  await showObservabilityResult(result, pack, repo);
}

// ── Pack selection ───────────────────────────────────────────────────

async function pickRolloutPack(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration("narrate");
  const savedPack = config.get<string>("observability.rolloutPack", "");
  if (savedPack && ROLLOUT_PACKS[savedPack]) {
    return savedPack;
  }

  const items: vscode.QuickPickItem[] = Object.entries(ROLLOUT_PACKS).map(
    ([key, preset]) => ({
      label: preset.label,
      description: key,
      detail: preset.description
    })
  );

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Select observability rollout pack",
    title: "Narrate: Observability Rollout Pack"
  });

  return picked?.description;
}

// ── Execution ────────────────────────────────────────────────────────

async function executeObservabilityCheck(
  repo: RepoRootResolution,
  scriptPath: string,
  pack: RolloutPackPreset,
  logger: Logger
): Promise<ObservabilityResult> {
  const args = buildArgs(scriptPath, pack);
  let rawOutput = "";

  try {
    const psResult = await runPowerShellCommand(args, repo.repoRoot);
    rawOutput = psResult.stdout;
  } catch (error) {
    rawOutput = error instanceof Error ? error.message : String(error);
  }

  const parsed = parseJsonResult(rawOutput);
  if (parsed) {
    return parsed;
  }

  logger.warn("Observability check: unable to parse JSON result, treating as error.");
  return {
    ok: false,
    status: "blocked",
    evaluator_version: "unknown",
    deployment_profile: pack.deploymentProfile,
    adapters: [],
    summary: {
      adapters_enabled: 0, adapters_ready: 0,
      blockers: 1, warnings: 0,
      evaluated_at: new Date().toISOString()
    },
    findings: [{
      rule_id: "OBS-PARSE-001",
      severity: "blocker",
      adapter: "global",
      source: "extension",
      message: "Unable to parse observability check result.",
      hint: "Run `pg obs-check` in terminal for details."
    }]
  };
}

function buildArgs(scriptPath: string, pack: RolloutPackPreset): string[] {
  const args = [
    "-NoProfile", "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", scriptPath, "-Json",
    "-DeploymentProfile", pack.deploymentProfile
  ];
  const config = vscode.workspace.getConfiguration("narrate");
  const apiBase = config.get<string>("observability.apiBase", "");
  if (apiBase) args.push("-ApiBase", apiBase);
  const stateFile = config.get<string>("observability.stateFile", "");
  if (stateFile) args.push("-StateFile", stateFile);
  args.push("-OtlpEnabled", pack.otlpEnabled ? "on" : "off", "-OtlpHostedBy", pack.otlpHostedBy);
  args.push("-SentryEnabled", pack.sentryEnabled ? "on" : "off", "-SentryHostedBy", pack.sentryHostedBy);
  args.push("-SignozEnabled", pack.signozEnabled ? "on" : "off", "-SignozHostedBy", pack.signozHostedBy);
  return args;
}

// ── JSON parsing ─────────────────────────────────────────────────────

function parseJsonResult(raw: string): ObservabilityResult | undefined {
  try {
    const candidate = JSON.parse(raw.trim());
    if (candidate && typeof candidate.ok === "boolean" && candidate.deployment_profile) {
      return candidate as ObservabilityResult;
    }
  } catch {
    // not direct JSON
  }

  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.includes("\"deployment_profile\"")) {
      try {
        return JSON.parse(trimmed) as ObservabilityResult;
      } catch {
        continue;
      }
    }
  }

  return undefined;
}

// ── Result display ───────────────────────────────────────────────────

async function showObservabilityResult(
  result: ObservabilityResult,
  pack: RolloutPackPreset,
  repo: RepoRootResolution
): Promise<void> {
  const readyLabel = `${result.summary.adapters_ready}/${result.summary.adapters_enabled} ready`;

  if (result.ok && result.summary.blockers === 0) {
    const warnNote = result.summary.warnings > 0
      ? ` with ${result.summary.warnings} warning(s)`
      : "";
    vscode.window.showInformationMessage(
      `Narrate Observability [${pack.label}]: ${readyLabel} — passed${warnNote}.`
    );
    return;
  }

  const parts: string[] = [readyLabel];
  if (result.summary.blockers > 0) {
    parts.push(`${result.summary.blockers} blocker(s)`);
  }
  if (result.summary.warnings > 0) {
    parts.push(`${result.summary.warnings} warning(s)`);
  }

  const detail = parts.join(", ");
  const actions = ["Open Report", "Run in Terminal", "Change Rollout Pack"];

  const pick = await vscode.window.showErrorMessage(
    `Narrate Observability [${pack.label}]: ${detail}.`,
    ...actions
  );

  if (pick === "Open Report") {
    await openReport(repo);
  } else if (pick === "Run in Terminal") {
    await runInTerminal(repo);
  } else if (pick === "Change Rollout Pack") {
    await resetRolloutPack();
  }
}

// ── Report generation ────────────────────────────────────────────────

function writeObservabilityReport(
  result: ObservabilityResult,
  pack: RolloutPackPreset,
  repo: RepoRootResolution
): void {
  const reportPath = path.join(repo.repoRoot, GENERATED_DIR, REPORT_FILE);
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const lines: string[] = [
    "# Observability Adapter Health Report",
    "",
    `**Status:** ${result.status}`,
    `**Rollout Pack:** ${pack.label}`,
    `**Deployment Profile:** ${result.deployment_profile}`,
    `**Adapters Enabled:** ${result.summary.adapters_enabled}`,
    `**Adapters Ready:** ${result.summary.adapters_ready}`,
    `**Blockers:** ${result.summary.blockers}`,
    `**Warnings:** ${result.summary.warnings}`,
    `**Generated:** ${new Date().toISOString()}`,
    ""
  ];

  if (result.adapters.length > 0) {
    lines.push("## Adapter Status", "");
    lines.push("| Adapter | Readiness | Hosted By |");
    lines.push("|---------|-----------|-----------|");
    for (const a of result.adapters) {
      lines.push(`| ${a.adapter} | ${a.readiness} | ${a.hosted_by} |`);
    }
    lines.push("");
  }

  if (result.findings.length > 0) {
    lines.push("## Findings", "");
    lines.push("| Rule | Severity | Adapter | Message | Hint |");
    lines.push("|------|----------|---------|---------|------|");
    for (const f of result.findings) {
      lines.push(`| ${f.rule_id} | ${f.severity} | ${f.adapter} | ${f.message} | ${f.hint} |`);
    }
    lines.push("");
  }

  if (result.ok && result.findings.length === 0) {
    lines.push("## Result", "", "All observability adapter checks passed.", "");
  }

  lines.push("## Rollout Packs Reference", "");
  lines.push("| Pack | Profile | OTLP | Sentry | SigNoz |");
  lines.push("|------|---------|------|--------|--------|");
  for (const [key, p] of Object.entries(ROLLOUT_PACKS)) {
    const otlp = p.otlpEnabled ? `${p.otlpHostedBy}` : "off";
    const sentry = p.sentryEnabled ? `${p.sentryHostedBy}` : "off";
    const signoz = p.signozEnabled ? `${p.signozHostedBy}` : "off";
    lines.push(`| ${p.label} (${key}) | ${p.deploymentProfile} | ${otlp} | ${sentry} | ${signoz} |`);
  }
  lines.push("");

  lines.push("## Next Steps", "");
  lines.push("- Run `pg obs-check` in terminal for full interactive output.");
  lines.push("- Configure adapter endpoints and tokens in server `.env`.");
  lines.push("- Use `narrate.observability.rolloutPack` setting to save your preferred pack.");
  lines.push("");

  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}

// ── Quick actions ────────────────────────────────────────────────────

async function openReport(repo: RepoRootResolution): Promise<void> {
  const reportPath = path.join(repo.repoRoot, GENERATED_DIR, REPORT_FILE);
  if (fs.existsSync(reportPath)) {
    const doc = await vscode.workspace.openTextDocument(reportPath);
    await vscode.window.showTextDocument(doc, { preview: true });
  } else {
    vscode.window.showWarningMessage("Narrate: observability report not found.");
  }
}

async function runInTerminal(repo: RepoRootResolution): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: "PG Observability Check",
    cwd: repo.repoRoot
  });
  terminal.show();
  terminal.sendText(".\\pg.ps1 obs-check");
}

async function resetRolloutPack(): Promise<void> {
  const target = vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await vscode.workspace
    .getConfiguration("narrate")
    .update("observability.rolloutPack", undefined, target);
  vscode.window.showInformationMessage(
    "Narrate: rollout pack reset. Next run will prompt for selection."
  );
}
