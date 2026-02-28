type CommandRow = {
  command: string;
  expected: string;
};

type TroubleshootRow = {
  symptom: string;
  cause: string;
  fix: string;
};

const quickstartRows: CommandRow[] = [
  {
    command: ".\\pg.ps1 start -Yes",
    expected: "Session bootstrap complete + health checks run."
  },
  {
    command: ".\\pg.ps1 dev-profile -DevProfileAction init",
    expected: "Creates local dev-only profile (gitignored)."
  },
  {
    command: ".\\pg.ps1 dev-profile -DevProfileAction check",
    expected: "Shows missing fields and local-only policy state."
  },
  {
    command: ".\\pg.ps1 status",
    expected: "Displays Memory-bank session status."
  },
  {
    command: ".\\pg.ps1 login -Email \"you@example.com\"",
    expected:
      "Authenticates CLI state and syncs entitlement profile (`pg_cli_*`) for recommended prod profile."
  },
  {
    command: ".\\pg.ps1 update",
    expected:
      "Refreshes entitlement snapshot/token-backed profile sync without re-running OTP flow."
  },
  {
    command: ".\\pg.ps1 doctor",
    expected:
      "Runs PG CLI diagnostics (PATH shadowing, token validity, backend health, required tools, dev-profile readiness)."
  },
  {
    command: ".\\pg.ps1 narrate-check",
    expected: "Runs Milestone 10G core Narrate flow PASS/FAIL check and writes markdown report."
  },
  {
    command:
      ".\\pg.ps1 closure-check -ApiBase \"http://127.0.0.1:8787\" -PublicBaseUrl \"https://pg-ext.addresly.com\"",
    expected:
      "Runs one-shot Milestone closure matrix (10F Slack + 10G Narrate) and writes a combined report (strict mode)."
  },
  {
    command:
      ".\\pg.ps1 closure-check -ClosureMode local-core -ApiBase \"http://127.0.0.1:8787\" -PublicBaseUrl \"https://pg-ext.addresly.com\"",
    expected:
      "Runs closure matrix but allows tunnel-only public endpoint failures while keeping local flow checks strict."
  },
  {
    command: ".\\pg.ps1 db-index-check",
    expected:
      "Runs DB index maintenance diagnostics and prints blockers/warnings plus next remediation command."
  },
  {
    command: ".\\pg.ps1 db-check",
    expected: "Short alias for db-index-check."
  },
  {
    command: ".\\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck",
    expected:
      "Agent-first as-you-go verification: runs post-write enforcement + DB diagnostics and auto-generates fix plan when findings exist."
  },
  {
    command:
      ".\\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck",
    expected:
      "As-you-go verification for UI tasks: includes optional Playwright smoke checks in the same run."
  },
  {
    command: ".\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck",
    expected:
      "Strict final self-check before task completion (no warn mode)."
  },
  {
    command: ".\\pg.ps1 prod",
    expected:
      "Runs production baseline with standard rollout defaults: dependency + coding + API contract + DB index checks."
  },
  {
    command: ".\\pg.ps1 prod -ProdProfile strict",
    expected:
      "Runs strict rollout: standard checks plus Playwright smoke verification."
  },
  {
    command: ".\\pg.ps1 mcp-cloud-score -WorkloadSensitivity regulated",
    expected:
      "Runs local scanner set, submits metadata-only payload to MCP cloud scorer, and returns one combined production readiness score."
  },
  {
    command: ".\\pg.ps1 cloud-score -WorkloadSensitivity regulated",
    expected: "Short alias for mcp-cloud-score."
  },
  {
    command:
      ".\\pg.ps1 mcp-cloud-score -WorkloadSensitivity regulated -ControlCloudflareTunnel pass -ControlSecretsManager pass -ControlDbPortNotPublic pass",
    expected:
      "Adds explicit cloud-control evidence into the metadata score so regulated architecture checks can pass/block deterministically."
  },
  {
    command: ".\\pg.ps1 observability-check",
    expected:
      "Checks self-hosted observability adapter readiness (none|otlp|sentry|signoz) for PG-hosted default and enterprise BYOC modes."
  },
  {
    command: ".\\pg.ps1 obs-check",
    expected:
      "Short alias for observability-check (easier to remember for students/operators)."
  },
  {
    command:
      ".\\pg.ps1 db-index-fix-plan -DbMaxRows 5 -DbPlanOutputPath .\\Memory-bank\\_generated\\db-index-fix-plan-next5.md",
    expected:
      "Generates copy/paste SQL plan (pg_stat_statements setup + guard/drop/rollback index SQL candidates)."
  },
  {
    command: ".\\pg.ps1 db-fix -DbMaxRows 5",
    expected: "Short alias for db-index-fix-plan."
  },
  {
    command: "Narrate: Generate Codebase Tour",
    expected:
      "Scans workspace architecture and opens onboarding map (entrypoints, route surface, dependency and coupling hotspots)."
  },
  {
    command: "Narrate: Run Dead Code Scan",
    expected:
      "Generates a confidence-tiered dead-code candidate report (high from TS unused diagnostics, medium/low from import-graph orphan checks)."
  },
  {
    command: "Narrate: Create Dead Code Cleanup Branch",
    expected:
      "Creates or switches to a dedicated cleanup branch, runs dead-code scan, and opens the report for safe cleanup flow."
  },
  {
    command: "Narrate: Apply Safe Dead Code Fixes",
    expected:
      "Applies organize-imports on high-confidence dead-code files, then re-runs scan and opens before/after report."
  },
  {
    command: "Narrate: Run Environment Doctor",
    expected:
      "Scans env usage vs .env/.env.example and opens a missing/unused/exposed report."
  },
  {
    command: "Narrate: Run API Contract Validator",
    expected:
      "Runs OpenAPI-first API contract checks (backend inference fallback) and reports request/response mismatches."
  },
  {
    command: "Narrate: OpenAPI Check",
    expected:
      "Quick alias for API Contract Validator with easier command name for students/new users."
  },
  {
    command: "Narrate: OpenAPI Fix Handoff Prompt",
    expected:
      "Builds a mismatch-fix prompt from latest scan and copies it to clipboard for Codex/LLM patching."
  },
  {
    command: "Narrate: Environment Doctor Quick Fix (.env.example)",
    expected:
      "Runs doctor and appends missing referenced keys into .env.example placeholders."
  },
  {
    command: "Narrate: Show Trust Score Report",
    expected:
      "Opens latest deterministic trust report (rule IDs, blockers, warnings, score)."
  },
  {
    command: "Narrate: Open Trust Score Panel",
    expected:
      "Focuses Trust Score sidebar panel with score badge, findings list, and quick actions."
  },
  {
    command: "Narrate: Toggle Trust Score",
    expected:
      "Turns Trust Score enforcement on/off without editing settings manually."
  },
  {
    command: "Narrate: Refresh Trust Score",
    expected:
      "Runs Trust Score immediately (useful when auto-refresh is set to manual mode)."
  },
  {
    command: "Narrate: Run Trust Score Workspace Scan",
    expected:
      "Scans workspace source files and opens aggregate Trust report with worst files and blocker totals."
  },
  {
    command: "Narrate: Restart TypeScript + Refresh Trust Score",
    expected:
      "Runs save-all, restarts TS server, then refreshes Trust Score to clear stale diagnostics."
  },
  {
    command: "Narrate: Setup Validation Library",
    expected:
      "Installs latest validation package (Zod recommended) and offers docs + trust refresh."
  },
  {
    command: "Narrate: PG Push (Git Add/Commit/Push)",
    expected:
      "Runs PG pre-push enforcement plus Trust Gate, Dead Code Gate, and Commit Quality Gate (`off`/`relaxed`/`strict`) before git push."
  }
];

const governanceRows: CommandRow[] = [
  {
    command:
      ".\\pg.ps1 governance-login -ApiBase \"http://127.0.0.1:8787\" -Email \"you@example.com\"",
    expected: "Writes local worker token/state."
  },
  {
    command:
      ".\\pg.ps1 governance-bind -ThreadId \"6c920350-9b8c-4067-a0f0-92c8a9b9b42a\" -ActionKey default-handler",
    expected: "Maps a thread decision to local action handler."
  },
  {
    command: ".\\pg.ps1 governance-worker -Once",
    expected: "Pulls pending decisions, executes local action, sends ack."
  },
  {
    command: ".\\pg.ps1 governance-bind -List",
    expected: "Shows action keys and active bindings."
  },
  {
    command:
      ".\\pg.ps1 slack-check -ApiBase \"http://127.0.0.1:8787\" -PublicBaseUrl \"https://pg-ext.addresly.com\"",
    expected:
      "Runs one-shot PASS/FAIL Slack transport matrix and writes markdown report."
  }
];

const narrationUiRows: CommandRow[] = [
  {
    command: "Narrate: Switch Reading View Mode (Exact/Section)",
    expected: "Toggles between strict 1:1 lines and grouped section summaries."
  },
  {
    command: "Narrate: Switch Reading Pane Mode (Split/Full)",
    expected: "Moves narration output beside code or into current full tab."
  },
  {
    command: "Narrate: Toggle Source Snippet (Code/Meaning)",
    expected: "In exact mode, choose code+meaning or meaning-only lines."
  },
  {
    command: "Narrate: Toggle EDU Detail Level (Standard/Beginner/Full Beginner)",
    expected: "Cycles explanation depth from concise to beginner to full beginner."
  }
];

const slackRows: CommandRow[] = [
  {
    command:
      "/pg thread Live rollout check :: Should we continue rollout? :: approve|needs-change|reject",
    expected:
      "Creates a decision thread and returns Thread ID + option keys (opt1/opt2/opt3)."
  },
  {
    command: "/pg vote 6c920350-9b8c-4067-a0f0-92c8a9b9b42a opt1",
    expected: "Records vote for selected option key."
  },
  {
    command: "/pg decide 6c920350-9b8c-4067-a0f0-92c8a9b9b42a approve opt1 final-go",
    expected: "Finalizes decision (owner/manager role required)."
  },
  {
    command: "/pg summary",
    expected: "Shows account + team roles + module access."
  }
];

const troubleshootingRows: TroubleshootRow[] = [
  {
    symptom: "ParserError: '<' operator is reserved for future use",
    cause: "You pasted placeholder text like <THREAD_ID> literally.",
    fix: "Use the real UUID in quotes. Example: -ThreadId \"6c920...\""
  },
  {
    symptom:
      "Cannot validate argument on parameter 'Command'. The argument 'db-index-check' does not belong to set 'install,start,...'",
    cause: "PowerShell resolved global pg CLI from PATH, not this repo script.",
    fix: "Run local command with prefix: .\\pg.ps1 db-index-check"
  },
  {
    symptom: "The term '.\\pg.ps1' is not recognized",
    cause: "Terminal is not in repo root directory.",
    fix: "cd to project root, then run .\\pg.ps1 <command>."
  },
  {
    symptom: "PG Self Check reports blockers while coding",
    cause: "Post-write policy checks detected real gating findings.",
    fix: "Use rule IDs in the output to fix blockers, then rerun .\\pg.ps1 self-check (strict mode before completion)."
  },
  {
    symptom: "SHOW: The term 'SHOW' is not recognized",
    cause: "SQL statement was typed directly into PowerShell.",
    fix: "Run SQL in PostgreSQL (psql/Prisma/pgAdmin), not as shell command."
  },
  {
    symptom: "Terminal is stuck on prompt '>>'",
    cause: "PowerShell is in multiline continuation mode.",
    fix: "Press Ctrl+C once, then rerun a single full command line."
  },
  {
    symptom: "No connection could be made (127.0.0.1:8787)",
    cause: "Backend is not running.",
    fix: "Start server: cd server, then npm run start (or npm run dev)."
  },
  {
    symptom: "invalid bearer token",
    cause: "Missing/expired token in worker state.",
    fix: "Run governance-login again and rerun governance-worker -Once."
  },
  {
    symptom: "No access token available. Run .\\pg.ps1 login first.",
    cause: "PG CLI lifecycle state is missing/expired.",
    fix: "Run .\\pg.ps1 login, then .\\pg.ps1 update (optional), and retry command."
  },
  {
    symptom: "Slack command failed: thread not found",
    cause: "Thread ID or option key is stale or incorrect.",
    fix: "Create fresh /pg thread, copy exact Thread ID, then vote/decide."
  },
  {
    symptom: "Operation timed out. Apps need to respond within three seconds",
    cause: "Slack action callback did not receive fast ack.",
    fix: "Retry after backend health is true and tunnel/domain is healthy."
  },
  {
    symptom: "/pg failed with the error \"dispatch_failed\"",
    cause: "Slack could not deliver or process response in time.",
    fix: "Check /health and /integrations/slack/health, then retry command."
  },
  {
    symptom: "/pg command does not trigger from composer",
    cause: "Slash command is not the first token (for example: `1. /pg summary`).",
    fix: "Start message exactly with `/pg ...` and send it as a slash command."
  },
  {
    symptom: "TypeScript errors stay in Problems after compile passes",
    cause: "TS language service is stale (editor diagnostics not refreshed yet).",
    fix: "Run `Narrate: Restart TypeScript + Refresh Trust Score`, then re-check report/push."
  },
  {
    symptom: "PG Push blocks commit message as low quality",
    cause: "Commit message is generic or not conventional format.",
    fix: "Use suggested message or format as `type(scope): clear summary` (for example: `fix(auth): handle token refresh error`)."
  },
  {
    symptom: "PG Push blocked by Dead Code Gate in strict mode",
    cause: "High-confidence unused code diagnostics were detected.",
    fix: "Use `Apply Safe Fixes + Recheck` in the gate prompt, then clean remaining items from report before re-running push."
  },
  {
    symptom: "No new governance events",
    cause: "Nothing pending for current cursor/token (not an error).",
    fix: "Create/finalize a new thread, then run governance-worker -Once again."
  }
];

function renderCommands(title: string, rows: CommandRow[]): string {
  const items = rows
    .map(
      (row) => `
      <tr>
        <td><code>${escapeHtml(row.command)}</code></td>
        <td>${escapeHtml(row.expected)}</td>
      </tr>`
    )
    .join("");

  return `
    <section>
      <h3>${escapeHtml(title)}</h3>
      <table>
        <thead>
          <tr><th>Command</th><th>Expected Result</th></tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
    </section>`;
}

function renderTroubleshooting(rows: TroubleshootRow[]): string {
  const items = rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.symptom)}</td>
        <td>${escapeHtml(row.cause)}</td>
        <td>${escapeHtml(row.fix)}</td>
      </tr>`
    )
    .join("");

  return `
    <section>
      <h3>Troubleshooting</h3>
      <table>
        <thead>
          <tr><th>Symptom</th><th>Likely Cause</th><th>What To Do</th></tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
    </section>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const HELP_STYLE = `
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 8px 12px 20px; line-height: 1.45; }
  h2 { margin-top: 0; font-size: 1.15rem; }
  h3 { margin: 16px 0 8px; font-size: 1rem; }
  p { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; table-layout: fixed; }
  th, td { border: 1px solid var(--vscode-panel-border); padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: var(--vscode-editorWidget-background); }
  td code { white-space: pre-wrap; word-break: break-word; font-family: var(--vscode-editor-font-family); }
  .note { border-left: 3px solid var(--vscode-focusBorder); padding: 6px 10px; background: var(--vscode-editorWidget-background); }
  .small { opacity: 0.9; font-size: 0.9rem; }
`;

const DIAGNOSTICS_SECTION = `
  <section>
    <h3>5) One-Click Diagnostics</h3>
    <p>Run <code>Narrate: Run Command Diagnostics</code> from Command Palette to check:</p>
    <ul>
      <li>Backend health endpoint</li>
      <li>Slack integration health endpoint</li>
      <li>Local dev-profile readiness</li>
      <li>Governance worker one-shot pull/apply path</li>
      <li>Narrate flow baseline wiring check</li>
    </ul>
    <p>A diagnostics report opens automatically with pass/fail and fix hints.</p>
    <p>Diagnostics are also saved to:</p>
    <ul>
      <li><code>Memory-bank/_generated/command-diagnostics-latest.md</code></li>
      <li><code>Memory-bank/_generated/command-diagnostics-latest.json</code></li>
      <li>timestamped <code>.md</code> and <code>.json</code> snapshots in the same folder.</li>
    </ul>
    <p>After run, use quick actions in the toast: <code>Open Latest Report</code>, <code>Open Diagnostics Folder</code>, or <code>Copy Latest Path</code>.</p>
    <p>Run <code>Narrate: Run Environment Doctor</code> to detect missing, unused, and potentially exposed env variables.</p>
    <p>Trust Score panel is available in the Narrate Help sidebar with one-click refresh/toggle actions.</p>
  </section>
`;

function renderHelpSections(): string {
  return [
    renderCommands("1) Local Quickstart (PG)", quickstartRows),
    renderCommands("2) Decision Sync (Local Worker)", governanceRows),
    renderCommands("3) Narrate Reading UI Toggles", narrationUiRows),
    renderCommands("4) Slack Decision Commands", slackRows),
    DIAGNOSTICS_SECTION,
    renderTroubleshooting(troubleshootingRows),
    "<p class=\"small\">Security rule: local dev profile is for dev/test only and stays gitignored. Production secrets remain in .env/vault.</p>"
  ].join("");
}

function renderHelpDocument(style: string, body: string): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${style}</style>
  </head>
  <body>
    <h2>Narrate Command Help</h2>
    <p class="note">
      Decision flow only: this channel is for <strong>thread/vote/decide</strong> governance actions, not general chat.
      Use real IDs and quoted values. Do not paste placeholder values like <code>&lt;THREAD_ID&gt;</code>.
    </p>
    ${body}
  </body>
  </html>`;
}

export function buildCommandHelpHtml(): string {
  return renderHelpDocument(HELP_STYLE, renderHelpSections());
}
