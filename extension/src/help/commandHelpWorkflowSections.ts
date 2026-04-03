type CommandRow = {
  command: string;
  expected: string;
};

type WorkflowAccessRow = {
  workflow: string;
  commands: string;
  access: string;
  notes: string;
};

const workflowAccessRows: WorkflowAccessRow[] = [
  {
    workflow: "Extension prompt handoff",
    commands: "Narrate: Request Change Prompt, Narrate: OpenAPI Fix Handoff Prompt",
    access: "Free for Request Change Prompt; Pro/Team/Enterprise for OpenAPI Fix Handoff Prompt",
    notes:
      "Use these from the VS Code Command Palette when you need prompt-ready change or API-fix handoff text."
  },
  {
    workflow: "Frontend/backend integration",
    commands: ".\\pg.ps1 integration-*, .\\pg.ps1 backend-start, .\\pg.ps1 frontend-start",
    access: "Pro/Team/Enterprise",
    notes:
      "This workflow is a paid handoff surface; Team and Enterprise keep the same command family with shared orchestration."
  },
  {
    workflow: "Secure review workflow",
    commands: ".\\pg.ps1 review-*",
    access: "Pro/Team/Enterprise",
    notes:
      "Team adds shared review operations, while Enterprise layers reviewer automation and stricter org controls on top."
  },
  {
    workflow: "Slack + governance",
    commands: ".\\pg.ps1 governance-*, /pg thread|vote|decide",
    access: "Team/Enterprise",
    notes:
      "Use this for team voting and decision sync. Enterprise adds reviewer automation and offline policy-pack operations."
  }
];

export const extensionPromptRows: CommandRow[] = [
  {
    command: "Narrate: Request Change Prompt",
    expected:
      "Free extension prompt handoff: builds a guided edit prompt from selected lines and copies it to clipboard."
  },
  {
    command: "Narrate: OpenAPI Fix Handoff Prompt",
    expected:
      "Pro+ extension handoff: builds an API mismatch fix prompt from the latest contract scan and copies it to clipboard."
  },
  {
    command: "Narrate: Open Model Settings",
    expected:
      "Opens provider settings for extension-side narration and prompt workflows."
  },
  {
    command: "Narrate: Run Startup For Current Context",
    expected:
      "Re-runs the nearest-context startup when a nested repo or PG root changes inside the current VS Code window."
  }
];

export const integrationWorkflowRows: CommandRow[] = [
  {
    command: ".\\pg.ps1 integration-init",
    expected:
      "Pro+ workflow bootstrap for the shared frontend/backend integration ledger when an older repo does not have it yet."
  },
  {
    command: ".\\pg.ps1 backend-start / .\\pg.ps1 frontend-start",
    expected:
      "Pro+ role claim commands for the integration workflow once the project root is already installed and started."
  },
  {
    command: ".\\pg.ps1 integration-summary / integration-next -Role backend|frontend",
    expected:
      "Pro+ summary and next-step polling for backend/frontend handoff pages."
  },
  {
    command: ".\\pg.ps1 integration-report / integration-respond",
    expected:
      "Pro+ structured finding and response flow between frontend and backend without direct cross-role edits."
  }
];

export const reviewWorkflowRows: CommandRow[] = [
  {
    command: ".\\pg.ps1 review-init / review-status / review-summary",
    expected:
      "Pro+ secure review workflow bootstrap and current-state visibility for the active repo review batch."
  },
  {
    command: ".\\pg.ps1 review-builder-start / review-reviewer-start",
    expected:
      "Pro+ role claim commands for builder/reviewer review workers with optional persistent heartbeat loops."
  },
  {
    command: ".\\pg.ps1 review-report / review-respond / review-approve",
    expected:
      "Pro+ structured reviewer findings, builder replies, and reviewer approval in the secure review ledger."
  },
  {
    command: ".\\pg.ps1 review-stop -Role builder|reviewer / review-end",
    expected:
      "Pro+ clean stop or completion controls for long-running review workers. Team shares this surface; Enterprise adds reviewer automation policy above it."
  }
];

export function renderWorkflowQuickAccess(escapeHtml: (value: string) => string): string {
  const items = [
    { label: "Prompt Commands", href: "#extension-prompts" },
    { label: "Frontend + Backend", href: "#integration-workflow" },
    { label: "Secure Review", href: "#review-workflow" },
    { label: "Decision Sync", href: "#decision-sync" },
    { label: "Slack Commands", href: "#slack-commands" },
    { label: "Troubleshooting", href: "#troubleshooting" }
  ]
    .map(
      (item) =>
        `<a class="quick-link" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
    )
    .join("");

  return `
    <section id="workflow-shortcuts">
      <h3>Quick Access</h3>
      <p class="small">Use these links when you want the workflow commands fast without scanning the full tables.</p>
      <div class="quick-links">${items}</div>
    </section>`;
}

export function renderWorkflowAccess(escapeHtml: (value: string) => string): string {
  const items = workflowAccessRows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.workflow)}</td>
        <td><code>${escapeHtml(row.commands)}</code></td>
        <td>${escapeHtml(row.access)}</td>
        <td>${escapeHtml(row.notes)}</td>
      </tr>`
    )
    .join("");

  return `
    <section id="workflow-access-map">
      <h3>1) Workflow Access Map</h3>
      <table>
        <thead>
          <tr><th>Workflow</th><th>Primary Commands</th><th>Plan Access</th><th>Notes</th></tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
    </section>`;
}