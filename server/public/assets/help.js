"use strict";

const tierRank = { free: 0, trial: 1, pro: 2, team: 3, enterprise: 4 };
const tierBadgeClass = {
  free: "b-free",
  trial: "b-trial",
  pro: "b-pro",
  team: "b-team",
  enterprise: "b-enterprise"
};
const tierLabels = { free: "Free", trial: "Trial", pro: "Pro", team: "Team", enterprise: "Enterprise" };
const commandGroupOrder = [
  "Extension essentials",
  "Extension prompts + handoff",
  "CLI foundations",
  "Quality + validation",
  "Frontend/backend integration",
  "Secure review workflow",
  "Team governance",
  "Enterprise controls"
];

const commandCatalog = [
  { cmd: "Narrate: Toggle Reading Mode (Dev)", desc: "Open or close core reading view in development mode.", surface: "VS Code", minTier: "free" },
  { cmd: "Narrate: Toggle Reading Mode (Edu)", desc: "Open education reading mode with simplified explanations.", surface: "VS Code", minTier: "trial" },
  { cmd: "Narrate: Switch Reading View Mode", desc: "Toggle Exact vs Section reading format.", surface: "VS Code", minTier: "free" },
  { cmd: "Narrate: Switch Reading Pane Mode", desc: "Switch split vs full reading pane layout.", surface: "VS Code", minTier: "free" },
  { cmd: "Narrate: Toggle Source Snippet", desc: "Switch code+meaning vs meaning-only rendering.", surface: "VS Code", minTier: "free" },
  { cmd: "Narrate: Toggle EDU Detail Level", desc: "Cycle standard, beginner, and full beginner explanation depth.", surface: "VS Code", minTier: "free" },
  { cmd: "Narrate: Run Environment Doctor", desc: "Find missing/unused env references quickly.", surface: "VS Code", minTier: "free" },
  { cmd: "Narrate: Open Model Settings", desc: "One-click jump to Settings filtered for narrate.model.* provider keys.", surface: "VS Code", minTier: "free" },
  { cmd: "Provider Proof Test (Ollama/OpenRouter)", desc: "Set narrate.model.baseUrl/modelId/apiKey, then run Narrate reading mode on a file to verify provider-backed narration.", surface: "VS Code", minTier: "free" },
  { cmd: "Narrate: Request Change Prompt", desc: "Builds a guided edit prompt from selected lines and copies it to clipboard.", surface: "VS Code", minTier: "free" },
  { cmd: "Narrate: Show Trust Score Report", desc: "Open server-backed trust analysis and blocker details.", surface: "VS Code", minTier: "free" },
  { cmd: "Narrate: Refresh Trust Score", desc: "Manual refresh of backend trust evaluation plus local diagnostics.", surface: "VS Code", minTier: "free" },
  { cmd: ".\\pg.ps1 help", desc: "Show commands available in this project's installed PG profile.", surface: "CLI", minTier: "free" },
  { cmd: ".\\pg.ps1 start -Yes", desc: "Start memory-bank session with strict map-structure gate by default on legacy repos.", surface: "CLI", minTier: "free" },
  { cmd: ".\\pg.ps1 integration-init", desc: "Scaffold the shared frontend/backend integration ledger for existing or legacy repos when it is missing.", surface: "CLI", minTier: "pro" },
  { cmd: ".\\pg.ps1 backend-start", desc: "Claim the backend role in the shared integration ledger and publish backend heartbeat/state.", surface: "CLI", minTier: "pro" },
  { cmd: ".\\pg.ps1 frontend-start", desc: "Claim the frontend role in the shared integration ledger and publish frontend heartbeat/state.", surface: "CLI", minTier: "pro" },
  { cmd: ".\\pg.ps1 integration-summary", desc: "Refresh the short dashboard at Memory-bank/frontend-integration.md and linked page statuses.", surface: "CLI", minTier: "pro" },
  { cmd: ".\\pg.ps1 integration-next -Role backend|frontend", desc: "Show the next integration page or step for the selected role.", surface: "CLI", minTier: "pro" },
  { cmd: ".\\pg.ps1 integration-report / integration-respond", desc: "Record frontend findings for backend or backend responses/fixes in the shared page ledger.", surface: "CLI", minTier: "pro" },
  { cmd: ".\\pg.ps1 review-init", desc: "Create the secure builder/reviewer workflow ledger for the current repo.", surface: "CLI", minTier: "pro" },
  { cmd: ".\\pg.ps1 review-builder-start / review-reviewer-start", desc: "Claim the builder or reviewer role and sync secure review heartbeat/state.", surface: "CLI", minTier: "pro" },
  { cmd: ".\\pg.ps1 review-report / review-respond / review-approve", desc: "Record reviewer findings, builder responses, and reviewer approval in the secure review ledger.", surface: "CLI", minTier: "pro" },
  { cmd: "Narrate: Run Startup For Current Context", desc: "Force a fresh nearest-context startup run when you enter a nested repo/subproject or need a retry.", surface: "VS Code", minTier: "free" },
  { cmd: ".\\pg.ps1 map-structure", desc: "Scan existing code + migration/schema files and generate auto code-tree/db-schema docs.", surface: "CLI", minTier: "free" },
  { cmd: ".\\pg.ps1 status", desc: "Show current memory-bank session status for this project root.", surface: "CLI", minTier: "free" },
  { cmd: ".\\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck", desc: "As-you-go compliance check.", surface: "CLI", minTier: "free" },
  { cmd: ".\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck", desc: "Strict required self-check before final Memory-bank update.", surface: "CLI", minTier: "free" },
  { cmd: ".\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck", desc: "Strict required self-check for UI/frontend changes (includes Playwright smoke).", surface: "CLI", minTier: "free" },
  { cmd: "Narrate: Export Narration (Current File)", desc: "Export narration for active file.", surface: "VS Code", minTier: "pro" },
  { cmd: "Narrate: Export Narration (Workspace)", desc: "Export full workspace narration package.", surface: "VS Code", minTier: "pro" },
  { cmd: "Narrate: Generate Change Report (Git Diff...)", desc: "Generate narrated diff timeline report.", surface: "VS Code", minTier: "pro" },
  { cmd: "Narrate: PG Push (Git Add/Commit/Push)", desc: "Run policy gates then push safely.", surface: "VS Code", minTier: "pro" },
  { cmd: "Narrate: Run Dead Code Scan", desc: "Run confidence-tiered dead code detection.", surface: "VS Code", minTier: "pro" },
  { cmd: "Narrate: Apply Safe Dead Code Fixes", desc: "Apply safe autofix path and recheck.", surface: "VS Code", minTier: "pro" },
  { cmd: "Narrate: Run API Contract Validator", desc: "Validate frontend/backend API contract mismatches.", surface: "VS Code", minTier: "pro" },
  { cmd: "Narrate: OpenAPI Fix Handoff Prompt", desc: "Creates API fix prompt and copies it to clipboard for agent handoff.", surface: "VS Code", minTier: "pro" },
  { cmd: "Narrate: Generate Codebase Tour", desc: "Create architecture tour for onboarding and review.", surface: "VS Code", minTier: "pro" },
  { cmd: ".\\pg.ps1 mcp-cloud-score", desc: "Submit metadata-only cloud readiness evidence.", surface: "CLI", minTier: "pro" },
  { cmd: ".\\pg.ps1 observability-check", desc: "Validate observability adapter readiness.", surface: "CLI", minTier: "pro" },
  { cmd: "Team Seat Assign/Revoke", desc: "Manage team memberships and seat lifecycle.", surface: "Portal", minTier: "team" },
  { cmd: "Team Provider Policy Update", desc: "Apply allowlist/denylist and provider control policy.", surface: "Portal", minTier: "team" },
  { cmd: "Narrate: Governance Sync Now", desc: "Manual one-click pull/apply governance event sync.", surface: "VS Code", minTier: "team" },
  { cmd: ".\\pg.ps1 governance-login", desc: "Initialize governance worker auth state.", surface: "CLI", minTier: "team" },
  { cmd: ".\\pg.ps1 governance-worker -Once", desc: "Pull and apply governance decisions locally.", surface: "CLI", minTier: "team" },
  { cmd: ".\\pg.ps1 governance-worker -PollSeconds 15", desc: "Run continuous governance polling loop while terminal stays active.", surface: "CLI", minTier: "team" },
  { cmd: ".\\pg.ps1 governance-digest", desc: "Load reviewer digest and governance KPIs.", surface: "CLI", minTier: "team" },
  { cmd: "/pg thread | /pg vote | /pg decide", desc: "Run Slack decision workflow commands.", surface: "Slack", minTier: "team" },
  { cmd: "Admin Board: Support/Subscriptions", desc: "Operate cross-account support and billing governance.", surface: "Portal", minTier: "team" },
  { cmd: ".\\pg.ps1 reviewer-policy", desc: "Manage reviewer automation assignment policy.", surface: "CLI", minTier: "enterprise" },
  { cmd: ".\\pg.ps1 reviewer-check", desc: "Validate reviewer automation and escalation state.", surface: "CLI", minTier: "enterprise" },
  { cmd: "Offline Policy Pack Issue/Rotate", desc: "Enterprise encrypted offline policy pack lifecycle.", surface: "Portal/API", minTier: "enterprise" },
  { cmd: "GET /account/enterprise/offline-pack/info", desc: "Read latest enterprise offline pack metadata for on-prem rollout state.", surface: "API", minTier: "enterprise" },
  { cmd: "POST /pg-global-admin/board/enterprise/offline-pack/issue", desc: "Issue encrypted offline pack for enterprise user/device policy scope.", surface: "API", minTier: "enterprise" },
  { cmd: "Strict Provider Policy (org-wide)", desc: "Apply strict provider controls for enterprise governance.", surface: "Portal", minTier: "enterprise" }
];

const deepDiveByTier = {
  pro: [
    {
      title: "Quality + Export Surface",
      body: "Pro unlocks export/report commands and quality gates for serious solo workflows.",
      bullets: ["Export file/workspace narration", "Generate change report", "Run dead-code and commit-quality checks", "Use frontend/backend integration workflow", "Use secure server-backed review workflow"]
    },
    {
      title: "Architecture + API Validation",
      body: "Pro includes architecture and contract validation command set.",
      bullets: ["Codebase tour", "API contract validator", "OpenAPI fix handoff prompt", "Prompt handoff stays visible in VS Code and /help"]
    }
  ],
  team: [
    {
      title: "Team Governance",
      body: "Team adds seat/policy control and collaborative governance operations.",
      bullets: ["Team seat admin", "Slack decision workflow", "Governance digest visibility", "Shared frontend/backend integration", "Shared secure review orchestration"]
    },
    {
      title: "Operational Control Plane",
      body: "Team includes board-level support and subscription control for operators.",
      bullets: ["Admin board support queue", "Subscription/session control", "Provider policy governance"]
    }
  ],
  enterprise: [
    {
      title: "Enterprise Automation",
      body: "Enterprise adds reviewer automation and strict organization policy enforcement.",
      bullets: ["Reviewer automation policy", "Strict provider scope", "High-control governance flows", "Enterprise review workflow automation"]
    },
    {
      title: "Offline + Advanced Controls",
      body: "Enterprise supports encrypted offline policy pack lifecycle and broader contractual operations.",
      bullets: ["Offline pack issue/rotate/revoke", "Offline pack info endpoint for rollout checks", "Customer-hosted/BYOC observability mode", "Expanded reviewer and escalation operations"]
    }
  ]
};

const state = {
  selectedTier: "free",
  searchText: "",
  selectedHelpPanel: "commands",
  tierButtons: Array.from(document.querySelectorAll("#tierButtons .tier-btn")),
  commandRows: document.getElementById("commandRows"),
  commandSearch: document.getElementById("commandSearch"),
  deepDiveCards: document.getElementById("deepDiveCards"),
  workflowShortcuts: Array.from(document.querySelectorAll("[data-help-tier]")),
  helpTabs: Array.from(document.querySelectorAll(".help-tab")),
  helpPanels: Array.from(document.querySelectorAll(".help-tab-panel"))
};

function canAccess(minTier) {
  return tierRank[state.selectedTier] >= tierRank[minTier];
}

function tierBadge(tier) {
  const cls = tierBadgeClass[tier] || "b-free";
  const label = tierLabels[tier] || tier;
  return `<span class="badge ${cls}">${label}+</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rowMatchesSearch(row) {
  const query = state.searchText.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return `${row.cmd} ${row.desc} ${row.surface}`.toLowerCase().includes(query);
}

function isReviewWorkflow(row) {
  return row.cmd.includes("review-");
}

function isIntegrationWorkflow(row) {
  const cmd = row.cmd;
  return cmd.includes("integration-") || cmd.includes("backend-start") || cmd.includes("frontend-start");
}

function isPromptCommand(row) {
  const cmd = row.cmd;
  return (
    cmd.includes("Request Change Prompt") ||
    cmd.includes("OpenAPI Fix Handoff Prompt") ||
    cmd.includes("Open Model Settings") ||
    cmd.includes("Provider Proof Test")
  );
}

function isEnterpriseControl(row) {
  const cmd = row.cmd;
  return row.minTier === "enterprise" || cmd.includes("reviewer-") || cmd.includes("Offline Policy Pack") || cmd.includes("offline-pack");
}

function isTeamGovernance(row) {
  const cmd = row.cmd;
  return (
    row.surface === "Slack" ||
    cmd.startsWith("/pg ") ||
    cmd.includes("governance-") ||
    cmd.includes("Governance Sync") ||
    cmd.includes("Team Seat") ||
    cmd.includes("Team Provider Policy") ||
    cmd.includes("Admin Board")
  );
}

function isQualityCommand(row) {
  const cmd = row.cmd;
  return (
    cmd.includes("Trust Score") ||
    cmd.includes("PG Push") ||
    cmd.includes("Dead Code") ||
    cmd.includes("API Contract") ||
    cmd.includes("OpenAPI") ||
    cmd.includes("Codebase Tour") ||
    cmd.includes("observability-check") ||
    cmd.includes("mcp-cloud-score") ||
    cmd.includes("Setup Validation")
  );
}

function getCommandGroup(row) {
  if (isReviewWorkflow(row)) {
    return "Secure review workflow";
  }
  if (isIntegrationWorkflow(row)) {
    return "Frontend/backend integration";
  }
  if (isPromptCommand(row)) {
    return "Extension prompts + handoff";
  }
  if (isEnterpriseControl(row)) {
    return "Enterprise controls";
  }
  if (isTeamGovernance(row)) {
    return "Team governance";
  }
  if (isQualityCommand(row)) {
    return "Quality + validation";
  }
  if (row.surface === "VS Code") {
    return "Extension essentials";
  }
  return "CLI foundations";
}

function getVisibleCommands() {
  return commandCatalog.filter((row) => canAccess(row.minTier) && rowMatchesSearch(row));
}

function renderCommandRow(row) {
  return `
    <tr>
      <td><code>${escapeHtml(row.cmd)}</code></td>
      <td>${escapeHtml(row.desc)}</td>
      <td>${escapeHtml(row.surface)}</td>
      <td>${tierBadge(row.minTier)}</td>
    </tr>`;
}

function renderGroupRow(group) {
  return `
    <tr class="command-group-row">
      <td colspan="4">${escapeHtml(group)}</td>
    </tr>`;
}

function renderCommands() {
  if (!state.commandRows) {
    return;
  }
  const visible = getVisibleCommands();
  if (!visible.length) {
    state.commandRows.innerHTML = "<tr><td colspan=\"4\">No commands match this tier + search.</td></tr>";
    return;
  }
  const grouped = new Map();
  visible.forEach((row) => {
    const group = getCommandGroup(row);
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group).push(row);
  });

  const orderedGroups = [
    ...commandGroupOrder.filter((group) => grouped.has(group)),
    ...Array.from(grouped.keys()).filter((group) => !commandGroupOrder.includes(group))
  ];

  state.commandRows.innerHTML = orderedGroups
    .map((group) => `${renderGroupRow(group)}${grouped.get(group).map(renderCommandRow).join("")}`)
    .join("");
}

function getVisibleDeepDiveCards() {
  const cards = [];
  if (tierRank[state.selectedTier] >= tierRank.pro) {
    cards.push(...deepDiveByTier.pro);
  }
  if (tierRank[state.selectedTier] >= tierRank.team) {
    cards.push(...deepDiveByTier.team);
  }
  if (tierRank[state.selectedTier] >= tierRank.enterprise) {
    cards.push(...deepDiveByTier.enterprise);
  }
  return cards;
}

function renderDeepDiveCard(card) {
  const bullets = card.bullets.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `
    <div class="card">
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.body)}</p>
      <ul class="muted-list">${bullets}</ul>
    </div>`;
}

function renderDeepDive() {
  if (!state.deepDiveCards) {
    return;
  }
  const cards = getVisibleDeepDiveCards();
  if (!cards.length) {
    state.deepDiveCards.innerHTML =
      "<div class=\"card\"><h3>Paid command details</h3><p>Select Pro/Team/Enterprise to view paid-tier deep dive blocks.</p></div>";
    return;
  }
  state.deepDiveCards.innerHTML = cards.map(renderDeepDiveCard).join("");
}

function setTier(tier) {
  state.selectedTier = tier;
  state.tierButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tier === tier);
  });
  renderCommands();
  renderDeepDive();
}

function registerTierHandlers() {
  state.tierButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setTier(button.dataset.tier || "free");
    });
  });
}

function registerSearchHandler() {
  if (!state.commandSearch) {
    return;
  }
  state.commandSearch.addEventListener("input", () => {
    state.searchText = state.commandSearch?.value || "";
    renderCommands();
  });
}

function applyWorkflowShortcut(button) {
  const tier = button.dataset.helpTier || "free";
  const search = button.dataset.helpSearch || "";
  setHelpPanel("commands");
  setTier(tier);
  if (state.commandSearch) {
    state.commandSearch.value = search;
  }
  state.searchText = search;
  renderCommands();
  const target = document.getElementById("tier-commands");
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function registerWorkflowShortcuts() {
  state.workflowShortcuts.forEach((button) => {
    button.addEventListener("click", () => {
      applyWorkflowShortcut(button);
    });
  });
}

function setHelpPanel(name) {
  state.selectedHelpPanel = name;
  state.helpTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.helpPanel === name);
  });
  state.helpPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.helpPanel === name);
  });
}

function registerHelpTabHandlers() {
  state.helpTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setHelpPanel(button.dataset.helpPanel || "commands");
    });
  });
}

function bootstrapHelpPage() {
  registerHelpTabHandlers();
  registerTierHandlers();
  registerSearchHandler();
  registerWorkflowShortcuts();
  setHelpPanel("commands");
  renderCommands();
  renderDeepDive();
}

bootstrapHelpPage();
