# Narrate VS Code Extension

Current implementation in this folder covers Milestone 1 + 2 + 3 + 4 + 5 + 6 + 7 core.

- virtual reading mode (`narrate://`)
- dev/edu mode toggles
- OpenAI-compatible narration provider
- local JSON cache
- section-based reading summaries
- edu-mode syntax/glossary enrichment
- request-change prompt handoff command
- export current file narration (Pro+ gated)
- export workspace narration bundle (Pro+ gated)
- git diff change report generation (Pro+ gated)
- licensing backend mode:
  - `Narrate: Sign In (Email)`
  - `Narrate: Sign In (GitHub)`
  - `Narrate: Redeem Code`
  - `Narrate: Start Trial (48h)`
  - `Narrate: Upgrade Plan (Checkout)` (opens browser checkout URL)
  - `Narrate: Refresh License`
  - `Narrate: License Status`
  - `Narrate: Activate Current Project Quota`
  - `Narrate: Show Project Quota`
  - `Narrate: Manage Devices`

Additional behavior:

- In backend mode, first-time Edu access auto-prompts sign-in and attempts 48h trial start.
- In placeholder mode, Edu access requires `narrate.licensing.placeholderPlan` to be `trial` or higher.
- Provider calls are blocked when entitlement provider policy denies configured model endpoint.

## Local run

```powershell
cd extension
npm install
npm run compile
```

Then press `F5` in VS Code from the `extension/` folder to launch Extension Development Host.

## Backend mode settings

In Extension Development Host settings:

- `narrate.licensing.mode = backend`
- `narrate.licensing.apiBaseUrl = http://127.0.0.1:8787`

Keep `narrate.licensing.mode = placeholder` if backend is not running.
