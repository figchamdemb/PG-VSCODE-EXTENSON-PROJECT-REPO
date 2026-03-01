/**
 * Environment Doctor – Inline Code Actions
 * Milestone 14A – Per-key inference + inline code actions.
 *
 * Provides CodeActionProvider for supported languages that detects
 * `process.env.X` / `import.meta.env.X` references and offers
 * quick-fix actions when the key is missing from `.env.example`.
 */

import * as vscode from "vscode";

const SUPPORTED_LANGUAGES = [
  "typescript", "typescriptreact", "javascript", "javascriptreact"
];

const ENV_KEY_ON_LINE =
  /(?:process\.env\.([A-Za-z_]\w*)|process\.env\[["'`]([A-Za-z_]\w*)["'`]\]|import\.meta\.env\.([A-Za-z_]\w*)|import\.meta\.env\[["'`]([A-Za-z_]\w*)["'`]\])/g;

export function registerEnvDoctorCodeActionProvider(): vscode.Disposable {
  const selector: vscode.DocumentSelector = SUPPORTED_LANGUAGES.map(
    (language) => ({ language, scheme: "file" })
  );
  return vscode.languages.registerCodeActionsProvider(
    selector,
    new EnvDoctorCodeActionProvider(),
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
  );
}

class EnvDoctorCodeActionProvider implements vscode.CodeActionProvider {
  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection
  ): Promise<vscode.CodeAction[]> {
    const line = document.lineAt(range.start.line);
    const text = line.text;
    if (!text.includes("env")) {
      return [];
    }

    const keys = extractEnvKeys(text);
    if (keys.length === 0) {
      return [];
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return [];
    }

    const envExampleKeys = await loadEnvExampleKeys(workspaceFolder.uri);
    const actions: vscode.CodeAction[] = [];
    for (const key of keys) {
      if (envExampleKeys.has(key)) {
        continue;
      }
      const action = new vscode.CodeAction(
        `Add ${key} to .env.example`,
        vscode.CodeActionKind.QuickFix
      );
      action.command = {
        title: `Add ${key} to .env.example`,
        command: "narrate.envDoctorAddKeyToExample",
        arguments: [workspaceFolder.uri, key]
      };
      action.isPreferred = true;
      actions.push(action);
    }
    return actions;
  }
}

function extractEnvKeys(line: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  ENV_KEY_ON_LINE.lastIndex = 0;
  for (const match of line.matchAll(ENV_KEY_ON_LINE)) {
    const key = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

async function loadEnvExampleKeys(
  workspaceUri: vscode.Uri
): Promise<Set<string>> {
  const uri = vscode.Uri.joinPath(workspaceUri, ".env.example");
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(bytes).toString("utf8");
    return parseEnvKeys(content);
  } catch {
    return new Set();
  }
}

function parseEnvKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/u
    );
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

/** Infer a contextual placeholder value for the given env key. */
function inferPlaceholder(key: string): string {
  const k = key.toUpperCase();
  if (k === "NODE_ENV") return "development";
  if (k === "PORT" || k.endsWith("_PORT")) return "3000";
  if (k === "HOST" || k.endsWith("_HOST")) return "localhost";
  if (/(DATABASE_URL|DB_URL|POSTGRES)/u.test(k)) return "postgresql://user:pass@localhost:5432/dbname";
  if (/(REDIS_URL|CACHE_URL)/u.test(k)) return "redis://localhost:6379";
  if (/URL|URI|ENDPOINT/u.test(k)) return "https://example.com";
  if (/(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)/u.test(k)) return "change-me-secret";
  if (/(ENABLED|DISABLED|DEBUG|VERBOSE|SECURE)/u.test(k)) return "false";
  if (/(TIMEOUT|TTL|MS|INTERVAL)/u.test(k)) return "30000";
  if (/(RETRIES|LIMIT|MAX|MIN|COUNT)/u.test(k)) return "10";
  if (/(EMAIL|MAIL_FROM)/u.test(k)) return "noreply@example.com";
  if (/(REGION|ZONE)/u.test(k)) return "us-east-1";
  if (/(LOG_LEVEL)/u.test(k)) return "info";
  return "__REQUIRED__";
}

/**
 * Command handler: appends a single key to `.env.example` with
 * a smart placeholder value derived from the key name.
 */
export async function addKeyToEnvExample(
  workspaceUri: vscode.Uri,
  key: string
): Promise<void> {
  const uri = vscode.Uri.joinPath(workspaceUri, ".env.example");
  let existing = "";
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    existing = Buffer.from(bytes).toString("utf8");
  } catch {
    // file does not exist — will be created
  }

  const existingKeys = parseEnvKeys(existing);
  if (existingKeys.has(key)) {
    void vscode.window.showInformationMessage(
      `${key} already exists in .env.example.`
    );
    return;
  }

  const placeholder = inferPlaceholder(key);
  const normalized = existing.replace(/\s+$/u, "");
  const separator = normalized.length > 0 ? "\n" : "";
  const next = `${normalized}${separator}${key}=${placeholder}\n`;

  await vscode.workspace.fs.writeFile(uri, Buffer.from(next, "utf8"));
  void vscode.window.showInformationMessage(
    `Added ${key}=${placeholder} to .env.example`
  );
}
