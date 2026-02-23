import { Finding, ProjectStats, TechStack } from "../types";

// ANSI color codes (no dependency needed)
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const ICONS = {
  blocker: `${RED}❌${RESET}`,
  warning: `${YELLOW}⚠️${RESET}`,
  info: `${CYAN}ℹ${RESET}`,
  pass: `${GREEN}✅${RESET}`,
};

export function printHeader(projectPath: string, stack: TechStack[]): void {
  console.log("");
  console.log(`${BOLD}╔══════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║       PRODUCTION READINESS CHECK             ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════════╝${RESET}`);
  console.log("");
  console.log(`  ${DIM}Project:${RESET}  ${projectPath}`);
  console.log(`  ${DIM}Stack:${RESET}    ${stack.join(", ")}`);
  console.log("");
}

export function printStats(stats: ProjectStats): void {
  console.log(`${DIM}─── Project Stats ──────────────────────────────${RESET}`);
  console.log(`  Files scanned:   ${stats.filesScanned}`);
  console.log(`  Total LOC:       ${stats.totalLoc.toLocaleString()}`);
  console.log(`  Largest file:    ${stats.maxFileLoc} LOC (${stats.maxFileLocPath})`);
  console.log("");
}

export function printFindings(findings: Finding[]): void {
  const blockers = findings.filter((f) => f.severity === "blocker" && f.status === "fail");
  const warnings = findings.filter((f) => f.severity === "warning" && f.status === "fail");
  const infos = findings.filter((f) => f.severity === "info" && f.status === "fail");

  if (blockers.length > 0) {
    console.log(`${RED}${BOLD}─── BLOCKERS (must fix before production) ──────${RESET}`);
    for (const f of blockers) {
      printFinding(f);
    }
    console.log("");
  }

  if (warnings.length > 0) {
    console.log(`${YELLOW}${BOLD}─── WARNINGS (recommended to fix) ──────────────${RESET}`);
    for (const f of warnings) {
      printFinding(f);
    }
    console.log("");
  }

  if (infos.length > 0) {
    console.log(`${CYAN}${BOLD}─── INFO (improvements) ────────────────────────${RESET}`);
    for (const f of infos) {
      printFinding(f);
    }
    console.log("");
  }

  if (findings.length === 0) {
    console.log(`${GREEN}${BOLD}  No issues found! 🎉${RESET}`);
    console.log("");
  }
}

function printFinding(f: Finding): void {
  const icon = ICONS[f.severity];
  const location = f.file ? `${DIM}${f.file}${f.line ? `:${f.line}` : ""}${RESET}` : "";

  console.log(`  ${icon} ${BOLD}[${f.ruleId}]${RESET} ${f.title}`);
  if (location) console.log(`     ${location}`);
  if (f.recommendation) console.log(`     ${DIM}→ ${f.recommendation}${RESET}`);
  console.log("");
}

export function printSummary(findings: Finding[]): void {
  const blockers = findings.filter((f) => f.severity === "blocker" && f.status === "fail").length;
  const warnings = findings.filter((f) => f.severity === "warning" && f.status === "fail").length;
  const infos = findings.filter((f) => f.severity === "info" && f.status === "fail").length;

  const isReady = blockers === 0;
  const score = calculateScore(findings);
  const grade = calculateGrade(score);

  console.log(`${BOLD}══════════════════════════════════════════════════${RESET}`);

  if (isReady) {
    console.log(`  ${GREEN}${BOLD}✅ PRODUCTION READY${RESET}`);
  } else {
    console.log(`  ${RED}${BOLD}🚫 NOT PRODUCTION READY${RESET}`);
  }

  console.log("");
  console.log(`  Score: ${BOLD}${score}/100${RESET}  |  Grade: ${BOLD}${grade}${RESET}`);
  console.log(`  ${RED}Blockers: ${blockers}${RESET}  |  ${YELLOW}Warnings: ${warnings}${RESET}  |  ${CYAN}Info: ${infos}${RESET}`);

  if (blockers > 0) {
    console.log("");
    console.log(`  ${RED}${blockers} blocker(s) must be resolved before deployment${RESET}`);
  }

  console.log(`${BOLD}══════════════════════════════════════════════════${RESET}`);
  console.log("");
}

function calculateScore(findings: Finding[]): number {
  // Start at 100, deduct points per finding
  // This is the LOCAL score — the API would apply proprietary weights
  let score = 100;
  for (const f of findings) {
    if (f.status !== "fail") continue;
    switch (f.severity) {
      case "blocker":
        score -= 15;
        break;
      case "warning":
        score -= 5;
        break;
      case "info":
        score -= 1;
        break;
    }
  }
  return Math.max(0, Math.min(100, score));
}

function calculateGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D";
  return "F";
}

// Generate markdown report
export function generateMarkdownReport(
  findings: Finding[],
  stats: ProjectStats,
  stack: TechStack[]
): string {
  const blockers = findings.filter((f) => f.severity === "blocker" && f.status === "fail");
  const warnings = findings.filter((f) => f.severity === "warning" && f.status === "fail");
  const infos = findings.filter((f) => f.severity === "info" && f.status === "fail");
  const score = calculateScore(findings);
  const grade = calculateGrade(score);
  const isReady = blockers.length === 0;

  let md = `# Production Readiness Report\n\n`;
  md += `**Date:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Stack:** ${stack.join(", ")}\n`;
  md += `**Score:** ${score}/100 | **Grade:** ${grade}\n`;
  md += `**Status:** ${isReady ? "✅ PRODUCTION READY" : "🚫 NOT PRODUCTION READY"}\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Files Scanned | ${stats.filesScanned} |\n`;
  md += `| Total LOC | ${stats.totalLoc.toLocaleString()} |\n`;
  md += `| Blockers | ${blockers.length} |\n`;
  md += `| Warnings | ${warnings.length} |\n`;
  md += `| Info | ${infos.length} |\n\n`;

  if (blockers.length > 0) {
    md += `## ❌ Blockers (Must Fix)\n\n`;
    for (const f of blockers) {
      md += `### [${f.ruleId}] ${f.title}\n`;
      if (f.file) md += `**File:** \`${f.file}${f.line ? `:${f.line}` : ""}\`\n\n`;
      md += `${f.detail}\n\n`;
      if (f.recommendation) md += `**Fix:** ${f.recommendation}\n\n`;
      md += `---\n\n`;
    }
  }

  if (warnings.length > 0) {
    md += `## ⚠️ Warnings (Recommended)\n\n`;
    for (const f of warnings) {
      md += `- **[${f.ruleId}]** ${f.title}`;
      if (f.file) md += ` — \`${f.file}\``;
      md += `\n`;
    }
    md += `\n`;
  }

  if (infos.length > 0) {
    md += `## ℹ️ Improvements\n\n`;
    for (const f of infos) {
      md += `- **[${f.ruleId}]** ${f.title}\n`;
    }
  }

  return md;
}
