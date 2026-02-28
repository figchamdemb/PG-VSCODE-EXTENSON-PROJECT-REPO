import * as path from "path";
import * as vscode from "vscode";
import { Logger } from "../utils/logger";

type EnvReference = {
  key: string;
  file: string;
  line: number;
};

type TypeMismatch = {
  key: string;
  value: string;
  expected: "number" | "boolean";
};

type EnvironmentDoctorResult = {
  scannedFiles: number;
  references: EnvReference[];
  envFilePresent: boolean;
  envExampleFilePresent: boolean;
  missingInEnv: EnvReference[];
  missingInEnvExample: EnvReference[];
  unusedInEnv: string[];
  exposedPublicSecrets: EnvReference[];
  typeMismatches: TypeMismatch[];
};

const SOURCE_INCLUDE_GLOB =
  "**/*.{ts,tsx,js,jsx,mjs,cjs,cts,mts,vue,svelte,py,java,go,rs,cs,php,rb}";
const SOURCE_EXCLUDE_GLOB =
  "**/{node_modules,.git,dist,build,out,coverage,.next,.turbo,Memory-bank,logs}/**";

const ENV_REFERENCE_PATTERNS: RegExp[] = [
  /\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
  /\bprocess\.env\[(["'`])([A-Za-z_][A-Za-z0-9_]*)\1\]/g,
  /\bimport\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
  /\bimport\.meta\.env\[(["'`])([A-Za-z_][A-Za-z0-9_]*)\1\]/g
];

export function registerRunEnvironmentDoctorCommand(
  logger: Logger
): vscode.Disposable {
  const runDoctorCommand = vscode.commands.registerCommand(
    "narrate.runEnvironmentDoctor",
    async () => {
      const workspaceFolder = getWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      const result = await runDoctorWithProgress(workspaceFolder.uri);
      await openEnvironmentDoctorReport(workspaceFolder.uri, result);
      await showEnvironmentDoctorSummary(logger, workspaceFolder.uri, result);
    }
  );

  const quickFixCommand = vscode.commands.registerCommand(
    "narrate.environmentDoctorQuickFixExample",
    async () => {
      const workspaceFolder = getWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      const result = await runDoctorWithProgress(workspaceFolder.uri);
      if (result.missingInEnvExample.length === 0) {
        void vscode.window.showInformationMessage(
          "Narrate Environment Doctor: .env.example already includes all referenced keys."
        );
        return;
      }

      await applyEnvExampleQuickFix(workspaceFolder.uri, result.missingInEnvExample);
      logger.info(
        `Environment Doctor quick fix: wrote ${result.missingInEnvExample.length} key(s) to .env.example`
      );
    }
  );

  return vscode.Disposable.from(
    runDoctorCommand,
    quickFixCommand
  );
}

function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    void vscode.window.showWarningMessage(
      "Narrate: open a workspace folder to run Environment Doctor."
    );
    return undefined;
  }
  return workspaceFolder;
}

async function runDoctorWithProgress(
  workspaceUri: vscode.Uri
): Promise<EnvironmentDoctorResult> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Narrate: Running Environment Doctor",
      cancellable: false
    },
    async (progress) => runEnvironmentDoctor(workspaceUri, progress)
  );
}

async function showEnvironmentDoctorSummary(
  logger: Logger,
  workspaceUri: vscode.Uri,
  result: EnvironmentDoctorResult
): Promise<void> {
  const issueCount =
    result.missingInEnv.length +
    result.missingInEnvExample.length +
    result.exposedPublicSecrets.length +
    result.typeMismatches.length;

  if (issueCount === 0) {
    void vscode.window.showInformationMessage(
      "Narrate Environment Doctor: no issues found."
    );
    logger.info("Environment Doctor completed: clean.");
    return;
  }

  if (result.missingInEnvExample.length > 0) {
    const picked = await vscode.window.showWarningMessage(
      `Narrate Environment Doctor: found ${issueCount} issue(s). Missing .env.example keys: ${result.missingInEnvExample.length}.`,
      "Quick Fix .env.example"
    );
    if (picked === "Quick Fix .env.example") {
      await applyEnvExampleQuickFix(workspaceUri, result.missingInEnvExample);
      logger.info("Environment Doctor quick fix applied from report action.");
      return;
    }
  }

  void vscode.window.showWarningMessage(
    `Narrate Environment Doctor: found ${issueCount} issue(s).`
  );
  logger.warn(`Environment Doctor completed: ${issueCount} issue(s).`);
}

async function runEnvironmentDoctor(
  workspaceUri: vscode.Uri,
  progress: vscode.Progress<{ message?: string }>
): Promise<EnvironmentDoctorResult> {
  progress.report({ message: "Scanning workspace files for env usage..." });
  const { references, scannedFiles } = await collectReferences(workspaceUri);

  progress.report({ message: "Reading .env and .env.example..." });
  const envPath = vscode.Uri.joinPath(workspaceUri, ".env");
  const envExamplePath = vscode.Uri.joinPath(workspaceUri, ".env.example");

  const envContent = await readOptionalText(envPath);
  const envExampleContent = await readOptionalText(envExamplePath);

  const envMap = parseEnvFile(envContent ?? "");
  const envExampleMap = parseEnvFile(envExampleContent ?? "");

  const missingInEnv = references.filter((reference) => !envMap.has(reference.key));
  const missingInEnvExample = references.filter(
    (reference) => !envExampleMap.has(reference.key)
  );

  const referenceKeys = new Set(references.map((reference) => reference.key));
  const unusedInEnv = Array.from(envMap.keys())
    .filter((key) => !referenceKeys.has(key))
    .sort((left, right) => left.localeCompare(right));

  const exposedPublicSecrets = references.filter(
    (reference) =>
      isPublicEnvKey(reference.key) && looksSensitiveEnvName(reference.key)
  );

  const typeMismatches = detectTypeMismatches(envMap);

  return {
    scannedFiles,
    references,
    envFilePresent: envContent !== null,
    envExampleFilePresent: envExampleContent !== null,
    missingInEnv,
    missingInEnvExample,
    unusedInEnv,
    exposedPublicSecrets,
    typeMismatches
  };
}

async function collectReferences(
  workspaceUri: vscode.Uri
): Promise<{ references: EnvReference[]; scannedFiles: number }> {
  const fileUris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceUri, SOURCE_INCLUDE_GLOB),
    new vscode.RelativePattern(workspaceUri, SOURCE_EXCLUDE_GLOB),
    1200
  );

  const firstReferenceByKey = new Map<string, EnvReference>();
  for (const fileUri of fileUris) {
    const textDocument = await vscode.workspace.openTextDocument(fileUri);
    const lines = textDocument.getText().split(/\r?\n/u);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!line.includes("env")) {
        continue;
      }
      for (const match of findEnvMatches(line)) {
        if (firstReferenceByKey.has(match)) {
          continue;
        }
        firstReferenceByKey.set(match, {
          key: match,
          file: vscode.workspace.asRelativePath(fileUri, false),
          line: lineIndex + 1
        });
      }
    }
  }

  const references = Array.from(firstReferenceByKey.values()).sort((left, right) =>
    left.key.localeCompare(right.key)
  );
  return {
    references,
    scannedFiles: fileUris.length
  };
}

function findEnvMatches(line: string): string[] {
  const matches: string[] = [];
  for (const pattern of ENV_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of line.matchAll(pattern)) {
      const key = match[2] ?? match[1];
      if (key) {
        matches.push(key);
      }
    }
  }
  return matches;
}

async function readOptionalText(uri: vscode.Uri): Promise<string | null> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return null;
  }
}

function parseEnvFile(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = content.split(/\r?\n/u);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) {
      continue;
    }
    const key = match[1];
    const value = stripWrappingQuotes(match[2].trim());
    map.set(key, value);
  }
  return map;
}

function stripWrappingQuotes(value: string): string {
  if (value.length < 2) {
    return value;
  }
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === "\"" || first === "'") && first === last) {
    return value.slice(1, -1);
  }
  return value;
}

function detectTypeMismatches(envMap: Map<string, string>): TypeMismatch[] {
  const mismatches: TypeMismatch[] = [];
  for (const [key, value] of envMap) {
    if (!value) {
      continue;
    }
    if (expectsNumberValue(key) && !looksLikeNumber(value)) {
      mismatches.push({ key, value, expected: "number" });
      continue;
    }
    if (expectsBooleanValue(key) && !looksLikeBoolean(value)) {
      mismatches.push({ key, value, expected: "boolean" });
    }
  }
  return mismatches.sort((left, right) => left.key.localeCompare(right.key));
}

function expectsNumberValue(key: string): boolean {
  return /(^|_)(PORT|TIMEOUT|TTL|RETRIES|LIMIT|DAYS|SECONDS|MS|MINUTES|HOURS)$/iu.test(
    key
  );
}

function expectsBooleanValue(key: string): boolean {
  return /(^|_)(ENABLED|DISABLED|DEBUG|SECURE|VERBOSE)$/iu.test(key);
}

function looksLikeNumber(value: string): boolean {
  return /^-?\d+(\.\d+)?$/u.test(value.trim());
}

function looksLikeBoolean(value: string): boolean {
  return /^(true|false|1|0|yes|no)$/iu.test(value.trim());
}

function isPublicEnvKey(key: string): boolean {
  return key.startsWith("NEXT_PUBLIC_") || key.startsWith("VITE_");
}

function looksSensitiveEnvName(key: string): boolean {
  if (/(SECRET|TOKEN|PASSWORD|PRIVATE|DATABASE_URL|DB_URL|CONNECTION_STRING)/iu.test(key)) {
    return true;
  }
  return /_KEY$/iu.test(key) && !/PUBLIC_KEY$/iu.test(key);
}

async function openEnvironmentDoctorReport(
  workspaceUri: vscode.Uri,
  result: EnvironmentDoctorResult
): Promise<void> {
  const title = "# Environment Doctor";
  const now = `UTC: ${new Date().toISOString()}`;
  const root = `Workspace: ${workspaceUri.fsPath}`;
  const summary = [
    "",
    "## Summary",
    "",
    `- Files scanned: ${result.scannedFiles}`,
    `- Env references found: ${result.references.length}`,
    `- .env present: ${result.envFilePresent ? "yes" : "no"}`,
    `- .env.example present: ${result.envExampleFilePresent ? "yes" : "no"}`,
    `- Missing in .env: ${result.missingInEnv.length}`,
    `- Missing in .env.example: ${result.missingInEnvExample.length}`,
    `- Unused in .env: ${result.unusedInEnv.length}`,
    `- Exposed public-secret keys: ${result.exposedPublicSecrets.length}`,
    `- Type mismatches: ${result.typeMismatches.length}`
  ].join("\n");

  const sections: string[] = [];
  sections.push(renderReferenceSection("Missing in .env", result.missingInEnv));
  sections.push(
    renderReferenceSection("Missing in .env.example", result.missingInEnvExample)
  );
  sections.push(renderKeyListSection("Unused keys in .env", result.unusedInEnv));
  sections.push(
    renderReferenceSection(
      "Potentially exposed public secret keys",
      result.exposedPublicSecrets
    )
  );
  sections.push(renderTypeMismatchSection(result.typeMismatches));
  sections.push(renderEnvExampleSuggestion(result.missingInEnvExample));

  const content = [title, "", now, "", root, summary, ...sections].join("\n\n");

  const document = await vscode.workspace.openTextDocument({
    content,
    language: "markdown"
  });
  await vscode.window.showTextDocument(document, { preview: false });
}

function renderReferenceSection(title: string, references: EnvReference[]): string {
  if (references.length === 0) {
    return `## ${title}\n\n- none`;
  }

  const lines = references
    .map(
      (reference) =>
        `- \`${reference.key}\` at \`${normalizeSlashes(reference.file)}:${reference.line}\``
    )
    .join("\n");

  return `## ${title}\n\n${lines}`;
}

function renderKeyListSection(title: string, keys: string[]): string {
  if (keys.length === 0) {
    return `## ${title}\n\n- none`;
  }
  const lines = keys.map((key) => `- \`${key}\``).join("\n");
  return `## ${title}\n\n${lines}`;
}

function renderTypeMismatchSection(mismatches: TypeMismatch[]): string {
  if (mismatches.length === 0) {
    return "## Type Mismatches\n\n- none";
  }

  const lines = mismatches
    .map(
      (mismatch) =>
        `- \`${mismatch.key}\` value \`${mismatch.value}\` looks invalid for expected ${mismatch.expected}.`
    )
    .join("\n");

  return `## Type Mismatches\n\n${lines}`;
}

function renderEnvExampleSuggestion(missingInExample: EnvReference[]): string {
  if (missingInExample.length === 0) {
    return "## Suggested .env.example Additions\n\n- none";
  }

  const lines = missingInExample
    .map((reference) => `${reference.key}=__REQUIRED__`)
    .join("\n");

  return `## Suggested .env.example Additions\n\n\`\`\`env\n${lines}\n\`\`\``;
}

function normalizeSlashes(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

async function applyEnvExampleQuickFix(
  workspaceUri: vscode.Uri,
  missingInExample: EnvReference[]
): Promise<void> {
  const envExampleUri = vscode.Uri.joinPath(workspaceUri, ".env.example");
  const existingContent = (await readOptionalText(envExampleUri)) ?? "";
  const parsed = parseEnvFile(existingContent);

  const keysToAdd = Array.from(
    new Set(missingInExample.map((reference) => reference.key))
  )
    .filter((key) => !parsed.has(key))
    .sort((left, right) => left.localeCompare(right));

  if (keysToAdd.length === 0) {
    void vscode.window.showInformationMessage(
      "Narrate Environment Doctor: no new keys to add to .env.example."
    );
    return;
  }

  const additions = keysToAdd.map((key) => `${key}=__REQUIRED__`).join("\n");
  const normalizedExisting = existingContent.replace(/\s+$/u, "");
  const separator = normalizedExisting.length > 0 ? "\n\n" : "";
  const nextContent = `${normalizedExisting}${separator}${additions}\n`;

  await vscode.workspace.fs.writeFile(envExampleUri, Buffer.from(nextContent, "utf8"));

  const document = await vscode.workspace.openTextDocument(envExampleUri);
  await vscode.window.showTextDocument(document, { preview: false });
  void vscode.window.showInformationMessage(
    `Narrate Environment Doctor: added ${keysToAdd.length} key(s) to .env.example.`
  );
}
