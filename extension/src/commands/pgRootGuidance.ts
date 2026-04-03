import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const ROOT_SCAN_DEPTH = 2;

type RootScanNode = {
  dir: string;
  depth: number;
};

export async function showPgRootGuidance(operationLabel: string): Promise<void> {
  const roots = findLikelyPgRoots();
  const actions = buildActions(roots.length > 0);
  const message = buildWarningMessage(operationLabel, roots.length);
  const choice = await vscode.window.showWarningMessage(message, ...actions);

  if (!choice) {
    return;
  }

  if (choice === "Open Fix Guide") {
    await openFixGuide(operationLabel, roots);
    return;
  }

  const firstRoot = roots[0];
  if (!firstRoot) {
    return;
  }

  if (choice === "Copy PowerShell Fix") {
    const command = `Set-Location "${firstRoot}"\n.\\pg.ps1 help`;
    await vscode.env.clipboard.writeText(command);
    void vscode.window.showInformationMessage(
      "Narrate: copied PowerShell root-fix command."
    );
    return;
  }

  if (choice === "Open Terminal In Root") {
    const terminal = vscode.window.createTerminal({
      name: "PG Root Fix",
      cwd: firstRoot
    });
    terminal.show();
    terminal.sendText(".\\pg.ps1 help");
  }
}

function buildActions(hasDetectedRoot: boolean): string[] {
  if (!hasDetectedRoot) {
    return ["Open Fix Guide"];
  }
  return ["Open Fix Guide", "Copy PowerShell Fix", "Open Terminal In Root"];
}

function buildWarningMessage(operationLabel: string, rootCount: number): string {
  if (rootCount > 0) {
    return `Narrate: ${operationLabel} needs a PG project root (folder with pg.ps1). Found ${rootCount} possible root(s).`;
  }
  return `Narrate: ${operationLabel} needs a PG project root (folder with pg.ps1).`;
}

function findLikelyPgRoots(): string[] {
  const roots = new Set<string>();
  for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
    collectPgRootsFrom(workspaceFolder.uri.fsPath, roots);
  }
  return Array.from(roots).sort((a, b) => a.localeCompare(b));
}

function collectPgRootsFrom(startDir: string, roots: Set<string>): void {
  const queue: RootScanNode[] = [{ dir: startDir, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      continue;
    }
    const canonical = node.dir.toLowerCase();
    if (visited.has(canonical)) {
      continue;
    }
    visited.add(canonical);

    if (isPgProjectRoot(node.dir)) {
      roots.add(node.dir);
    }
    if (node.depth >= ROOT_SCAN_DEPTH) {
      continue;
    }

    let children: fs.Dirent[] = [];
    try {
      children = fs.readdirSync(node.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const child of children) {
      if (!child.isDirectory() || shouldSkipDir(child.name)) {
        continue;
      }
      queue.push({
        dir: path.join(node.dir, child.name),
        depth: node.depth + 1
      });
    }
  }
}

function isPgProjectRoot(dir: string): boolean {
  const rootPg = path.join(dir, "pg.ps1");
  const scriptPg = path.join(dir, "scripts", "pg.ps1");
  return fs.existsSync(rootPg) && fs.existsSync(scriptPg);
}

function shouldSkipDir(name: string): boolean {
  return [
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".cache",
    "Memory-bank"
  ].includes(name);
}

async function openFixGuide(operationLabel: string, roots: string[]): Promise<void> {
  const body = buildFixGuide(operationLabel, roots);
  const doc = await vscode.workspace.openTextDocument({
    content: body,
    language: "markdown"
  });
  await vscode.window.showTextDocument(doc, { preview: false });
}

function buildFixGuide(operationLabel: string, roots: string[]): string {
  const lines: string[] = [];
  lines.push("# PG Root Fix Guide");
  lines.push("");
  lines.push(`Command blocked: **${operationLabel}**`);
  lines.push("");
  lines.push("This command must run in the project root folder that contains:");
  lines.push("- `pg.ps1`");
  lines.push("- `scripts/pg.ps1`");
  lines.push("");
  lines.push("## PowerShell");
  lines.push("```powershell");
  lines.push('Set-Location "C:\\real\\project\\root"');
  lines.push(".\\pg.ps1 help");
  lines.push(".\\pg.ps1 start -Yes");
  lines.push("```");
  lines.push("");
  lines.push("## CMD");
  lines.push("```bat");
  lines.push('cd /d "C:\\real\\project\\root"');
  lines.push('powershell -ExecutionPolicy Bypass -File ".\\pg.ps1" help');
  lines.push('powershell -ExecutionPolicy Bypass -File ".\\pg.ps1" start -Yes');
  lines.push("```");
  lines.push("");
  if (roots.length > 0) {
    lines.push("## Detected PG roots in this workspace");
    for (const root of roots) {
      lines.push(`- \`${root}\``);
    }
    lines.push("");
  } else {
    lines.push("## No PG root was detected in this workspace");
    lines.push("Run one-time scaffold install in your intended project root:");
    lines.push("- `pg install backend --target \".\"`");
    lines.push("- or `pg install frontend --target \".\"`");
    lines.push("");
  }
  return lines.join("\n");
}
