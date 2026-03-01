import * as vscode from "vscode";
import { TourSummary } from "./codebaseTourTypes";
import { getLastTourSummary } from "./generateCodebaseTour";
import { Logger } from "../utils/logger";

export function registerCodebaseTourGraphCommand(logger: Logger): vscode.Disposable {
  return vscode.commands.registerCommand("narrate.showCodebaseTourGraph", async () => {
    const summary = getLastTourSummary();
    if (!summary) {
      void vscode.window.showWarningMessage(
        "Narrate: run 'Generate Codebase Tour' first to populate graph data."
      );
      return;
    }
    showTourGraphPanel(summary);
    logger.info("Codebase tour graph panel opened.");
  });
}

function showTourGraphPanel(summary: TourSummary): void {
  const panel = vscode.window.createWebviewPanel(
    "narrate.codebaseTourGraph",
    "Narrate Codebase Tour Graph",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );
  panel.webview.html = buildGraphHtml(summary);
}

function getGraphCss(): string {
  return `body {
      margin: 0; padding: 16px;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #d4d4d4);
      font-family: var(--vscode-editor-font-family, monospace);
    }
    h2 { margin-top: 0; font-size: 16px; color: var(--vscode-editor-foreground, #d4d4d4); }
    .mermaid { display: flex; justify-content: center; margin-top: 16px; }
    .mermaid svg { max-width: 100%; }`;
}

function getMermaidScript(): string {
  return `<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: document.body.classList.contains('vscode-light') ? 'default' : 'dark',
      securityLevel: 'loose'
    });
  </script>`;
}

function buildGraphHtml(summary: TourSummary): string {
  const mermaid = buildMermaidDiagram(summary);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Codebase Tour Graph</title>
  <style>${getGraphCss()}</style>
</head>
<body>
  <h2>Narrate Codebase Tour — Architecture Graph</h2>
  <div class="mermaid">
${mermaid}
  </div>
  ${getMermaidScript()}
</body>
</html>`;
}

interface MermaidContext {
  lines: string[];
  dirIds: Map<string, string>;
  nodeIndex: number;
}

function mermaidSafeId(ctx: MermaidContext, label: string): string {
  const existing = ctx.dirIds.get(label);
  if (existing) { return existing; }
  ctx.nodeIndex += 1;
  const id = `N${ctx.nodeIndex}`;
  ctx.dirIds.set(label, id);
  return id;
}

function mermaidSanitize(value: string): string {
  return value.replace(/["`]/gu, "'").replace(/[<>]/gu, "");
}

function buildMermaidNodes(
  summary: TourSummary,
  ctx: MermaidContext
): { entryNodes: string[]; depNodes: string[] } {
  const entryNodes: string[] = [];
  for (const entry of summary.likelyEntrypoints.slice(0, 8)) {
    const id = mermaidSafeId(ctx, entry.file);
    ctx.lines.push(`  ${id}["🚀 ${mermaidSanitize(shortenPath(entry.file))}"]`);
    entryNodes.push(id);
  }
  for (const dir of summary.topDirectories.slice(0, 10)) {
    const id = mermaidSafeId(ctx, `dir:${dir.name}`);
    ctx.lines.push(`  ${id}["📁 ${mermaidSanitize(dir.name)} (${dir.count})"]`);
  }
  const depNodes: string[] = [];
  for (const dep of summary.externalDependencies.slice(0, 8)) {
    const id = mermaidSafeId(ctx, `dep:${dep.name}`);
    ctx.lines.push(`  ${id}(("📦 ${mermaidSanitize(dep.name)}"))`);
    depNodes.push(id);
  }
  if (summary.routeSurface.length > 0) {
    const routeId = mermaidSafeId(ctx, "routes");
    ctx.lines.push(`  ${routeId}["🌐 Routes (${summary.routeSurface.length})"]`);
  }
  return { entryNodes, depNodes };
}

function buildMermaidEdges(summary: TourSummary, ctx: MermaidContext): void {
  for (const entry of summary.likelyEntrypoints.slice(0, 8)) {
    const entryId = ctx.dirIds.get(entry.file);
    const dirId = ctx.dirIds.get(`dir:${entry.file.split("/")[0] || "<root>"}`);
    if (entryId && dirId) { ctx.lines.push(`  ${entryId} --> ${dirId}`); }
  }
  for (const hotspot of summary.internalHotspots.slice(0, 6)) {
    const dirId = ctx.dirIds.get(`dir:${hotspot.file.split("/")[0] || "<root>"}`);
    if (dirId) {
      const hsId = mermaidSafeId(ctx, `hs:${hotspot.file}`);
      ctx.lines.push(`  ${hsId}["🔥 ${mermaidSanitize(shortenPath(hotspot.file))} (${hotspot.localImports})"]`);
      ctx.lines.push(`  ${dirId} --> ${hsId}`);
    }
  }
  const routeId = ctx.dirIds.get("routes");
  if (routeId) {
    for (const route of summary.routeSurface.slice(0, 5)) {
      const dirId = ctx.dirIds.get(`dir:${route.split("/")[0] || "<root>"}`);
      if (dirId) { ctx.lines.push(`  ${dirId} --> ${routeId}`); break; }
    }
  }
}

function buildMermaidStyles(lines: string[], entryNodes: string[], depNodes: string[]): void {
  lines.push("  classDef entry fill:#2d6a4f,stroke:#40916c,color:#fff");
  lines.push("  classDef dep fill:#6c757d,stroke:#adb5bd,color:#fff");
  lines.push("  classDef hotspot fill:#e76f51,stroke:#f4845f,color:#fff");
  for (const id of entryNodes) { lines.push(`  class ${id} entry`); }
  for (const id of depNodes) { lines.push(`  class ${id} dep`); }
}

function buildMermaidDiagram(summary: TourSummary): string {
  const ctx: MermaidContext = { lines: ["graph TD"], dirIds: new Map(), nodeIndex: 0 };
  const { entryNodes, depNodes } = buildMermaidNodes(summary, ctx);
  buildMermaidEdges(summary, ctx);
  buildMermaidStyles(ctx.lines, entryNodes, depNodes);
  return ctx.lines.join("\n");
}

function shortenPath(filePath: string): string {
  const segments = filePath.split("/");
  if (segments.length <= 2) {
    return filePath;
  }
  return `${segments[0]}/.../${segments[segments.length - 1]}`;
}
