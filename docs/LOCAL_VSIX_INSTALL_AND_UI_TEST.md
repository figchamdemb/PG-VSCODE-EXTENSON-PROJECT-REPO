# Local VSIX Install + UI Test (Normal VS Code)

Use this when you want to test the extension like a real user before Marketplace publish.

If you also need project-root PG command onboarding (PowerShell vs CMD, first-run install/start),
see `docs/PG_FIRST_RUN_GUIDE.md`.

---

## What Window Should You Use?

- **Normal VS Code window**: your daily editor window. This is where installed VSIX extensions appear.
- **Extension Development Host**: debug/testing window from F5. This is only for development, not install verification.

If you want to verify installed VSIX behavior, use **normal VS Code**.

---

## One-Click Repeat Install (Recommended)

From project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\local_extension_install.ps1
```

What it does:
1. compiles the extension
2. packages a new `.vsix`
3. installs it into your normal VS Code profile (`--force`)
4. syncs the machine-wide PG CLI payload under `~\.pg-cli` so stale repos can use the latest scaffold-upgrade path from their own root

Windows note:
- the installer now prefers the VS Code CLI shim (`code.cmd`) instead of `Code.exe`
- if you previously saw `Code.exe: bad option: --install-extension`, rerun the updated script

---

## Button Workflow (No Manual Command Typing)

Use VS Code Tasks:

1. `Terminal` -> `Run Task...`
2. Select `local-install-extension-vsix`
3. Wait for `DONE` output
4. Run `Developer: Reload Window` in normal VS Code

Available tasks:
- `compile-extension`
- `package-extension-vsix`
- `local-install-extension-vsix`

---

## Where To Confirm It Is Installed

### In UI
1. Open Extensions view: `Ctrl+Shift+X`
2. Search: `figchamdemb.narrate-vscode-extension`
3. You should see it as **Installed** with the visible title **PG-Narrate**

### In terminal
```powershell
code --list-extensions | findstr narrate
```

Expected:
```text
figchamdemb.narrate-vscode-extension
```

Visible title in the Extensions panel:
```text
PG-Narrate
```

---

## How To Confirm UI Is Active

After install + reload, open any code file and check the status bar (bottom):

- `Narrate Reading (...)`
- `Narrate View: ...`
- `Narrate Pane: ...`
- `Narrate Source: ...`
- `Narrate Explain: ...`
- `Trust On` / `Trust Off`

If you can click those and they change state, UI toggles are working.

Note: in your screenshot, these status-bar items are already visible, which means the extension UI is active.

---

## Fast Re-Install After Code Changes

Any time you change extension code:

1. Run:
   - `Terminal -> Run Task... -> local-install-extension-vsix`
2. Reload normal VS Code window:
   - `Ctrl+Shift+P -> Developer: Reload Window`
3. Re-test status-bar toggles and commands.

If you have multiple PG repos open on the same machine:

- install the VSIX once
- then reload each already-open VS Code window that should use the new extension behavior

Important:
- VSIX install is machine/profile-level
- the local install script now also refreshes the machine-wide PG CLI payload (`~\.pg-cli`) from this repo, so stale repos can self-upgrade with `pg install backend -UpgradeScaffold`
- hooks, `pg.ps1`, Memory-bank state, and self-check are still repo-level
- after a repo-script enforcement update, go to that repo root and run:
   - `.\pg.ps1 start -Yes`
   - `powershell -ExecutionPolicy Bypass -File scripts\install_memory_bank_hooks.ps1 -Mode strict`
   - `.\pg.ps1 self-check -EnableDbIndexMaintenanceCheck`

---

## If You Still Don’t See It

1. Ensure you are in **normal VS Code**, not Extension Development Host.
2. Reload window (`Developer: Reload Window`).
3. Check installed list:
   - `code --list-extensions | findstr narrate`
4. Ensure setting is enabled:
   - `narrate.reading.showStatusBarControls = true`
   - `narrate.trustScore.showStatusBar = true`
5. Open a TypeScript/JavaScript file and check status bar again.
