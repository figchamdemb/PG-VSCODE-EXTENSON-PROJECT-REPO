export const HELP_STYLE = `
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 8px 12px 20px; line-height: 1.45; }
  h2 { margin-top: 0; font-size: 1.15rem; }
  h3 { margin: 16px 0 8px; font-size: 1rem; }
  p { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; table-layout: fixed; }
  th, td { border: 1px solid var(--vscode-panel-border); padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: var(--vscode-editorWidget-background); }
  td code { white-space: pre-wrap; word-break: break-word; font-family: var(--vscode-editor-font-family); }
  .note { border-left: 3px solid var(--vscode-focusBorder); padding: 6px 10px; background: var(--vscode-editorWidget-background); }
  .guide { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 8px 10px; margin: 10px 0 14px; }
  .guide h3 { margin-top: 2px; }
  .guide ul { margin: 6px 0 8px; padding-left: 18px; }
  .guide code { white-space: pre-wrap; word-break: break-word; }
  .small { opacity: 0.9; font-size: 0.9rem; }
`;

export const FIRST_RUN_SECTION = `
  <section class="guide">
    <h3>Before Running Any PG Command</h3>
    <p><strong>Run commands in the project root</strong> (the folder that contains <code>pg.ps1</code>).</p>
    <ul>
      <li>PowerShell: <code>Set-Location "C:\\real\\project\\root"</code></li>
      <li>CMD: <code>cd /d "C:\\real\\project\\root"</code></li>
    </ul>
    <p>Install once per project root, then start session:</p>
    <ul>
      <li>PowerShell: <code>pg install backend --target "."</code> (or <code>pg install frontend --target "."</code>) then <code>.\\pg.ps1 start -Yes</code></li>
      <li>CMD: <code>pg install backend --target "."</code> (or <code>pg install frontend --target "."</code>) then <code>powershell -ExecutionPolicy Bypass -File ".\\pg.ps1" start -Yes</code></li>
    </ul>
    <p><strong>Start gate:</strong> legacy repos now block session start by default if map docs are missing/stale. Fix with <code>.\\pg.ps1 map-structure</code>.</p>
    <p><strong>Optional warning-only mode:</strong> <code>.\\pg.ps1 start -Yes -EnforcementMode warn</code></p>
    <p><strong>Extension startup guard:</strong> Narrate now detects the nearest <code>AGENTS.md</code>/<code>pg.ps1</code> context, auto-runs startup once per context per UTC day, and re-runs when you move into a new nested repo. Manual retry command: <code>Narrate: Run Startup For Current Context</code>.</p>
    <p>If unsure which commands are available in your installed profile, run <code>.\\pg.ps1 help</code>.</p>
    <p><strong>Note:</strong> <code>.\\pg.ps1 update</code> is profile-dependent. Only run it if <code>help</code> lists it.</p>
    <p><strong>Planning rule:</strong> if scope changes, add a REQ tag in <code>Memory-bank/project-spec.md</code> and map it into milestones in <code>Memory-bank/project-details.md</code>.</p>
  </section>
`;

export const PRODUCT_EXPLAINER_SECTION = `
  <section class="guide">
    <h3>About The Product (Plain Language)</h3>
    <p><strong>Narrate</strong> is the VS Code layer: reading toggles, trust/doctor checks, export/report commands, and guided policy UX.</p>
    <p><strong>Memory-bank + PG install</strong> is the project-workflow layer: it scaffolds docs/scripts/hooks and enforces session/plan updates.</p>
    <p><strong>Important:</strong> <code>pg install</code> is script-driven scaffolding. It does not generate full app business architecture from specs automatically.</p>
    <ul>
      <li>New/empty project: writes PG + Memory-bank scaffolding (not your full app code).</li>
      <li>Existing project: adds missing PG/Memory-bank files and keeps your existing codebase.</li>
      <li>Legacy/half-built project: run <code>.\\pg.ps1 map-structure</code> to aggressively scan current source + migration/schema files into auto tree/schema docs.</li>
      <li>Frontend + backend are independent roots: install/start each root separately.</li>
      <li>Retention: daily reports are capped by <code>--keep-days</code> (default 7) when generator/start scripts run.</li>
      <li>Long logs are also capped: older entries in <code>agentsGlobal-memory.md</code> and <code>mastermind.md</code> are archived under <code>Memory-bank/_archive/</code> when limits are exceeded.</li>
      <li><code>Memory-bank/coding-security-standards.md</code> applies across frontend and backend checks.</li>
    </ul>
    <p>Core scaffold files include: <code>pg.ps1</code>, <code>scripts/pg.ps1</code>, <code>Memory-bank/project-spec.md</code>, <code>project-details.md</code>, <code>structure-and-db.md</code>, <code>tools-and-commands.md</code>, <code>agentsGlobal-memory.md</code>, and <code>mastermind.md</code>.</p>
    <p>For full web documentation with tabs, open <code>/help</code> then switch to <strong>About Narrate</strong> and <strong>About Memory-bank + PG Install</strong>.</p>
  </section>
`;

export const SLACK_DECISION_FLOW_SECTION = `
  <section class="guide">
    <h3>Slack Voting + Decision Flow (Team/Enterprise)</h3>
    <p>This is governance flow, not normal chat flow.</p>
    <table>
      <thead><tr><th>Step</th><th>Command</th><th>Outcome</th></tr></thead>
      <tbody>
        <tr>
          <td>Thread create</td>
          <td><code>/pg thread Release gate :: approve|needs-change|reject</code></td>
          <td>Creates decision thread and option keys.</td>
        </tr>
        <tr>
          <td>Vote</td>
          <td><code>/pg vote &lt;THREAD_ID&gt; opt1</code></td>
          <td>Records auditable team vote.</td>
        </tr>
        <tr>
          <td>Finalize</td>
          <td><code>/pg decide &lt;THREAD_ID&gt; approve opt1 final-go</code></td>
          <td>Final decision by policy-allowed role.</td>
        </tr>
        <tr>
          <td>Local apply</td>
          <td><code>.\\pg.ps1 governance-worker -Once</code></td>
          <td>Applies pending decisions and acks backend.</td>
        </tr>
      </tbody>
    </table>
    <p>Continuous local sync options:</p>
    <ul>
      <li><code>.\\pg.ps1 governance-worker -PollSeconds 15 -ApproveCommand "&amp; '.\\scripts\\governance_action_handler.ps1'"</code></li>
      <li>or extension auto sync via <code>narrate.governance.autoSync.*</code> settings.</li>
    </ul>
  </section>
`;

export const AUTOMATION_CLOUD_ENTERPRISE_SECTION = `
  <section class="guide">
    <h3>Automation, Cloud Score, Enterprise Benefits</h3>
    <table>
      <thead><tr><th>Capability</th><th>Auto</th><th>Manual Trigger</th></tr></thead>
      <tbody>
        <tr>
          <td>Startup guard on context change</td>
          <td>Yes</td>
          <td><code>Narrate: Run Startup For Current Context</code></td>
        </tr>
        <tr>
          <td>Governance sync</td>
          <td>Yes (when autoSync enabled)</td>
          <td><code>.\\pg.ps1 governance-worker -Once</code></td>
        </tr>
        <tr>
          <td>Trust score on save</td>
          <td>Yes</td>
          <td><code>Narrate: Refresh Trust Score</code></td>
        </tr>
        <tr>
          <td>Post-write enforcement</td>
          <td>Yes</td>
          <td><code>.\\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck</code></td>
        </tr>
        <tr>
          <td>Playwright smoke gates</td>
          <td>Required for UI code before final commit</td>
          <td><code>.\\pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck</code></td>
        </tr>
      </tbody>
    </table>
    <p><strong>Hard-enforced before final Memory-bank update:</strong> pre-commit guard blocks code commits unless latest strict self-check is PASS; UI-impacting changes must include Playwright smoke.</p>
    <p><strong>Cloud score:</strong> metadata-only scanner evidence scoring (dependency/coding/API contract/cloud controls).</p>
    <p><strong>Enterprise:</strong> reviewer automation, strict provider policy scope, offline policy-pack lifecycle, expanded governance operations, and customer-hosted/BYOC observability modes.</p>
    <p><strong>Enterprise offline package endpoints:</strong> <code>POST /account/enterprise/offline-pack/activate</code>, <code>GET /account/enterprise/offline-pack/info</code>, <code>POST /pg-global-admin/board/enterprise/offline-pack/issue</code>.</p>
  </section>
`;

export const PROVIDER_AND_HANDOFF_SECTION = `
  <section class="guide">
    <h3>Provider/API Setup + Handoff Behavior</h3>
    <p>Fast path: run <code>Narrate: Open Model Settings</code> to jump directly to provider keys.</p>
    <p>Configure provider in VS Code settings (<code>Ctrl+,</code>) by searching <code>narrate.model</code>:</p>
    <ul>
      <li><code>narrate.model.baseUrl</code> (OpenAI-compatible endpoint)</li>
      <li><code>narrate.model.modelId</code> (model name)</li>
      <li><code>narrate.model.apiKey</code> (provider key when required)</li>
      <li><code>narrate.model.timeoutMs</code></li>
    </ul>
    <p><strong>Quick proof test (Ollama example):</strong></p>
    <ul>
      <li>Run local Ollama API: <code>ollama serve</code></li>
      <li>Set <code>narrate.model.baseUrl = http://127.0.0.1:11434/v1</code></li>
      <li>Set <code>narrate.model.modelId = llama3.1</code> (or installed model)</li>
      <li>Open any code file and run <code>Narrate: Toggle Reading Mode (Dev)</code> to verify model-backed narration renders.</li>
    </ul>
    <p><strong>Mandatory before final Memory-bank update:</strong> run strict self-check.</p>
    <ul>
      <li>Backend/general: <code>.\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck</code></li>
      <li>UI/frontend changes: <code>.\\pg.ps1 self-check -EnableDbIndexMaintenanceCheck -EnablePlaywrightSmokeCheck</code></li>
    </ul>
    <p>Handoff commands (<code>Narrate: Request Change Prompt</code>, <code>Narrate: OpenAPI Fix Handoff Prompt</code>) copy prompt text to clipboard and open a markdown tab.</p>
    <p>Some chat extensions expose direct context actions (for example <code>Add to ...</code>/<code>Explain with ...</code>) and can send selection directly to their own chat boxes. Narrate keeps a provider-agnostic clipboard handoff path so it works even when those direct actions are unavailable.</p>
  </section>
`;

export const DIAGNOSTICS_SECTION = `
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
    <p>If a command says <code>needs a PG project root</code>, use the popup action <code>Open Fix Guide</code> for exact shell commands.</p>
    <p>Trust Score panel is available in the Narrate Help sidebar with one-click refresh/toggle actions and server-backed findings.</p>
  </section>
`;
