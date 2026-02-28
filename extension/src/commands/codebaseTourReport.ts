import { TourSummary } from "./codebaseTourTypes";

type PairItem = { label: string; count: number };

export function buildTourMarkdown(summary: TourSummary): string {
  const lines: string[] = [];
  appendHeader(lines, summary);
  appendSummary(lines, summary);
  appendEntrypoints(lines, summary);
  appendPairSection(lines, "Top Directories", summary.topDirectories, (item) => item.name);
  appendPairSection(lines, "Top File Extensions", summary.topExtensions, (item) => item.extension);
  appendPathSection(lines, "Route/Controller Surface", summary.routeSurface);
  appendDependencySection(lines, summary);
  appendHotspotsSection(lines, summary);
  appendPackageScripts(lines, summary);
  appendOnboardingPath(lines);
  return lines.join("\n");
}

function appendHeader(lines: string[], summary: TourSummary): void {
  lines.push("# Narrate Codebase Tour");
  lines.push("");
  lines.push(`UTC: ${summary.generatedAtUtc}`);
  lines.push(`Workspace: ${summary.workspaceRoot}`);
  lines.push("");
}

function appendSummary(lines: string[], summary: TourSummary): void {
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Files discovered: ${summary.filesDiscovered}`);
  lines.push(`- Files scanned: ${summary.filesScanned}`);
  lines.push(`- Test files detected: ${summary.testFileCount}`);
  lines.push(`- Likely entrypoints: ${summary.likelyEntrypoints.length}`);
  lines.push(`- Route/controller surface files: ${summary.routeSurface.length}`);
  lines.push("");
}

function appendEntrypoints(lines: string[], summary: TourSummary): void {
  lines.push("## Likely Entrypoints");
  lines.push("");
  if (summary.likelyEntrypoints.length === 0) {
    lines.push("- none");
    lines.push("");
    return;
  }

  for (const entry of summary.likelyEntrypoints) {
    lines.push(`- \`${entry.file}\` (score ${entry.score}) - ${entry.reason}`);
  }
  lines.push("");
}

function appendPairSection<T extends { count: number }>(
  lines: string[],
  title: string,
  items: T[],
  selectLabel: (item: T) => string
): void {
  lines.push(`## ${title}`);
  lines.push("");
  const normalized = items.map((item) => ({ label: selectLabel(item), count: item.count }));
  appendLabelCountList(lines, normalized);
  lines.push("");
}

function appendPathSection(lines: string[], title: string, values: string[]): void {
  lines.push(`## ${title}`);
  lines.push("");
  if (values.length === 0) {
    lines.push("- none");
    lines.push("");
    return;
  }
  for (const value of values) {
    lines.push(`- \`${value}\``);
  }
  lines.push("");
}

function appendDependencySection(lines: string[], summary: TourSummary): void {
  lines.push("## External Dependency Hotspots");
  lines.push("");
  if (summary.externalDependencies.length === 0) {
    lines.push("- none");
    lines.push("");
    return;
  }
  for (const item of summary.externalDependencies) {
    lines.push(`- \`${item.name}\`: ${item.count} import(s)`);
  }
  lines.push("");
}

function appendHotspotsSection(lines: string[], summary: TourSummary): void {
  lines.push("## Internal Coupling Hotspots");
  lines.push("");
  if (summary.internalHotspots.length === 0) {
    lines.push("- none");
    lines.push("");
    return;
  }
  for (const item of summary.internalHotspots) {
    lines.push(`- \`${item.file}\`: ${item.localImports} local import(s)`);
  }
  lines.push("");
}

function appendPackageScripts(lines: string[], summary: TourSummary): void {
  lines.push("## Package Script Entrypoints");
  lines.push("");
  if (summary.packageScripts.length === 0) {
    lines.push("- none");
    lines.push("");
    return;
  }

  for (const manifest of summary.packageScripts) {
    lines.push(`### ${manifest.file}`);
    lines.push(`- Scripts: ${formatScriptList(manifest.scripts)}`);
    lines.push("");
  }
}

function appendOnboardingPath(lines: string[]): void {
  lines.push("## Suggested Onboarding Path");
  lines.push("");
  lines.push("1. Start with top 3 entrypoints and package scripts.");
  lines.push("2. Walk route/controller surface to understand request flow.");
  lines.push("3. Review top coupling hotspots for core domain logic.");
  lines.push("4. Review external dependency hotspots for platform boundaries.");
}

function appendLabelCountList(lines: string[], items: PairItem[]): void {
  if (items.length === 0) {
    lines.push("- none");
    return;
  }
  for (const item of items) {
    lines.push(`- \`${item.label}\`: ${item.count}`);
  }
}

function formatScriptList(values: string[]): string {
  if (values.length === 0) {
    return "none";
  }
  return values.map((value) => `\`${value}\``).join(", ");
}
