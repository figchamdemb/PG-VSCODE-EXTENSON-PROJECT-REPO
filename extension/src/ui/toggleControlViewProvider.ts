import * as vscode from "vscode";
import { FeatureGateService } from "../licensing/featureGates";
import { NarrateSchemeProvider } from "../readingView/narrateSchemeProvider";
import { EduDetailLevel, NarrationMode, ReadingPaneMode, ReadingSnippetMode, ReadingViewMode } from "../types";
import {
  getCurrentEduDetailLevel,
  getCurrentMode,
  getCurrentReadingPaneMode,
  getCurrentReadingSnippetMode,
  getCurrentReadingViewMode,
  setCurrentEduDetailLevel,
  setCurrentMode,
  setCurrentReadingPaneMode,
  setCurrentReadingSnippetMode,
  setCurrentReadingViewMode
} from "../commands/modeState";
import { Logger } from "../utils/logger";

type ToggleState = {
  mode: NarrationMode;
  viewMode: ReadingViewMode;
  paneMode: ReadingPaneMode;
  snippetMode: ReadingSnippetMode;
  eduDetailLevel: EduDetailLevel;
};

type ToggleMessage = {
  type: "set" | "refresh-state";
  key?: "mode" | "viewMode" | "paneMode" | "snippetMode" | "eduDetailLevel";
  value?: string;
};

export class ToggleControlViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "narrate.toggleControlView";

  private webviewView: vscode.WebviewView | undefined;
  private onStateChanged: (() => void) | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly schemeProvider: NarrateSchemeProvider,
    private readonly featureGates: FeatureGateService,
    private readonly logger: Logger
  ) {}

  setOnStateChanged(callback: () => void): void {
    this.onStateChanged = callback;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = buildToggleControlHtml();
    webviewView.webview.onDidReceiveMessage((message: ToggleMessage) => {
      void this.handleMessage(message);
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.postCurrentState();
      }
    });
    this.postCurrentState();
    this.logger.info("Toggle control panel rendered.");
  }

  refresh(): void {
    this.postCurrentState();
  }

  private async handleMessage(message: ToggleMessage): Promise<void> {
    if (message.type === "refresh-state") {
      this.postCurrentState();
      return;
    }

    if (message.type !== "set" || !message.key || !message.value) {
      return;
    }

    const changed = await this.applyStateChange(message.key, message.value);
    if (changed) {
      await this.openNarrationWithCurrentState();
      this.onStateChanged?.();
    }
    this.postCurrentState();
  }

  private async applyStateChange(key: ToggleMessage["key"], value: string): Promise<boolean> {
    switch (key) {
      case "mode":
        return this.applyModeChange(value);
      case "viewMode":
        return this.applyViewModeChange(value);
      case "paneMode":
        return this.applyPaneModeChange(value);
      case "snippetMode":
        return this.applySnippetModeChange(value);
      case "eduDetailLevel":
        return this.applyEduDetailLevelChange(value);
      default:
        return false;
    }
  }

  private async applyModeChange(value: string): Promise<boolean> {
    if (value !== "dev" && value !== "edu") {
      return false;
    }
    if (value === "edu") {
      const allowed = await this.featureGates.requireEduViewFeature();
      if (!allowed) {
        return false;
      }
    }
    await setCurrentMode(this.context, value);
    return true;
  }

  private async applyViewModeChange(value: string): Promise<boolean> {
    if (value !== "exact" && value !== "section") {
      return false;
    }
    await setCurrentReadingViewMode(this.context, value);
    return true;
  }

  private async applyPaneModeChange(value: string): Promise<boolean> {
    if (value !== "sideBySide" && value !== "fullPage") {
      return false;
    }
    await setCurrentReadingPaneMode(this.context, value);
    return true;
  }

  private async applySnippetModeChange(value: string): Promise<boolean> {
    if (value !== "withSource" && value !== "narrationOnly") {
      return false;
    }
    await setCurrentReadingSnippetMode(this.context, value);
    return true;
  }

  private async applyEduDetailLevelChange(value: string): Promise<boolean> {
    if (value !== "standard" && value !== "beginner" && value !== "fullBeginner") {
      return false;
    }
    await setCurrentEduDetailLevel(this.context, value);
    return true;
  }

  private async openNarrationWithCurrentState(): Promise<void> {
    const state = this.getCurrentState();
    await this.schemeProvider.openNarrationFromContext({
      mode: state.mode,
      viewMode: state.viewMode,
      paneMode: state.paneMode,
      snippetMode: state.snippetMode,
      eduDetailLevel: state.eduDetailLevel
    });
  }

  private getCurrentState(): ToggleState {
    return {
      mode: getCurrentMode(this.context),
      viewMode: getCurrentReadingViewMode(this.context),
      paneMode: getCurrentReadingPaneMode(this.context),
      snippetMode: getCurrentReadingSnippetMode(this.context),
      eduDetailLevel: getCurrentEduDetailLevel(this.context)
    };
  }

  private postCurrentState(): void {
    if (!this.webviewView) {
      return;
    }
    void this.webviewView.webview.postMessage({
      type: "state",
      payload: this.getCurrentState()
    });
  }
}

function buildToggleControlHtml(): string {
  return renderToggleControlHtml(createNonce());
}

function renderToggleControlHtml(nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${TOGGLE_PANEL_STYLE}</style>
</head>
<body>
  ${TOGGLE_PANEL_BODY}
  <script nonce="${nonce}">${TOGGLE_PANEL_SCRIPT}</script>
</body>
</html>`;
}

function createNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

const TOGGLE_PANEL_STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 10px; line-height: 1.35; }
  h2 { margin: 0 0 8px; font-size: 1.08rem; }
  p { margin: 0 0 10px; opacity: 0.9; }
  .toggle-shell { display: grid; gap: 10px; }
  .toggle-panel { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 8px; background: var(--vscode-editorWidget-background); }
  .toggle-panel-header { font-weight: 600; margin: 0 0 6px; }
  .toggle-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .btn { border: 1px solid var(--vscode-button-border, transparent); border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: pointer; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .btn.active { border-color: var(--vscode-focusBorder); box-shadow: inset 0 0 0 1px var(--vscode-focusBorder); font-weight: 700; }
  .btn-nav { letter-spacing: 0.02em; }
  .btn-secondary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .btn-secondary:hover { background: var(--vscode-button-hoverBackground); }
  .tone-reading .btn.active { background: #8d2b2b; color: #ffffff; }
  .tone-view .btn.active { background: #9c7a1f; color: #111111; }
  .tone-pane .btn.active { background: #2f5c99; color: #ffffff; }
  .tone-source .btn.active { background: #2a7a64; color: #ffffff; }
  .tone-explain .btn.active { background: #6e4aa3; color: #ffffff; }
  .foot { margin-top: 10px; font-size: 12px; opacity: 0.8; }
`;

const TOGGLE_PANEL_BODY = `
  <div class="toggle-shell">
    <section class="toggle-panel">
      <h2>Narrate Toggle Panel</h2>
      <p>Click an option. Active choice is highlighted.</p>
    </section>
    <section class="toggle-panel tone-reading">
      <div class="toggle-panel-header">Reading Mode</div>
      <div class="toggle-grid">
        <button class="btn btn-nav" data-key="mode" data-value="dev">Dev</button>
        <button class="btn btn-nav" data-key="mode" data-value="edu">Edu</button>
      </div>
    </section>
    <section class="toggle-panel tone-view">
      <div class="toggle-panel-header">View</div>
      <div class="toggle-grid">
        <button class="btn btn-nav" data-key="viewMode" data-value="exact">Exact</button>
        <button class="btn btn-nav" data-key="viewMode" data-value="section">Section</button>
      </div>
    </section>
    <section class="toggle-panel tone-pane">
      <div class="toggle-panel-header">Pane</div>
      <div class="toggle-grid">
        <button class="btn btn-nav" data-key="paneMode" data-value="sideBySide">Split</button>
        <button class="btn btn-nav" data-key="paneMode" data-value="fullPage">Full</button>
      </div>
    </section>
    <section class="toggle-panel tone-source">
      <div class="toggle-panel-header">Source Snippet</div>
      <div class="toggle-grid">
        <button class="btn btn-nav" data-key="snippetMode" data-value="withSource">Code + Meaning</button>
        <button class="btn btn-nav" data-key="snippetMode" data-value="narrationOnly">Meaning Only</button>
      </div>
    </section>
    <section class="toggle-panel tone-explain">
      <div class="toggle-panel-header">Explain Level</div>
      <div class="toggle-grid">
        <button class="btn btn-nav" data-key="eduDetailLevel" data-value="standard">Standard</button>
        <button class="btn btn-nav" data-key="eduDetailLevel" data-value="beginner">Beginner</button>
        <button class="btn btn-nav" data-key="eduDetailLevel" data-value="fullBeginner">Full</button>
      </div>
    </section>
    <section class="toggle-panel">
      <div class="toggle-grid">
        <button class="btn btn-secondary" data-key="__refresh" data-value="refresh">Refresh State</button>
      </div>
      <p class="foot">Status-bar toggles stay available at the bottom.</p>
    </section>
  </div>
`;

const TOGGLE_PANEL_SCRIPT = `
  const vscode = acquireVsCodeApi();

  function sendSet(key, value) { vscode.postMessage({ type: "set", key, value }); }

  function setActive(state) {
    document.querySelectorAll("button[data-key]").forEach((button) => {
      const key = button.dataset.key;
      const value = button.dataset.value;
      if (!key || key === "__refresh") {
        button.classList.remove("active");
        return;
      }
      button.classList.toggle("active", String(state[key]) === String(value));
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("button[data-key]") : null;
    if (!target) { return; }
    const key = target.dataset.key;
    const value = target.dataset.value;
    if (!key || !value) { return; }
    if (key === "__refresh") {
      vscode.postMessage({ type: "refresh-state" });
      return;
    }
    sendSet(key, value);
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.type !== "state" || !message.payload) { return; }
    setActive(message.payload);
  });

  vscode.postMessage({ type: "refresh-state" });
`;
