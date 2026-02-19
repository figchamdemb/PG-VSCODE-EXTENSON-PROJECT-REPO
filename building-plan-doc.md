Below is a **full, build-ready specification** for **Narrate** (VS Code extension + minimal licensing backend + optional CLI), with finalized commercial packaging decisions for optional **PG Memory Bank** integration. This is designed to be copy/paste input for Codex/GPT-5.3 to implement.

Scope remains: build **Narrate first**. PG Memory Bank appears here only for entitlement/packaging integration and project-quota gating.

---

# MANDATORY BUILD WORKFLOW (Memory-bank)

Before implementation work in this project:

1. Run `pg start -Yes` from project root.
2. Confirm with `pg status`.
3. Implement tasks.
4. Before commit/final summary, update Memory-bank docs.
5. End shift with `pg end -Note "finished for today"`.

This project has Memory-bank enforcement installed and should be treated as mandatory context for all AI/dev sessions.

---

# NARRATE

Local-first code narration + audit/change reports + prompt handoff, with minimal cloud licensing.

## 0) Goals and non-goals

### Goals

1. **Full-file Reading Mode**: toggle to read any code file as English narration without modifying the source.
2. **Two narration modes**:

   * **Developer mode** (compact, technical)
   * **Edu mode** (non-technical, expanded glossary/syntax explanations)
3. **Strict translation**: explain what is present; do not invent behavior.
4. **Incremental caching**: re-narrate only changed lines/blocks.
5. **Change Reports** (Pro+): human-readable diffs (what changed, where, meaning) via git diff, optionally local timeline later.
6. **Prompt handoff**: generate context-rich “change request” prompts to paste into Copilot/Codex/Gemini/etc.
7. **Licensing**: Free + 2-day Edu trial (view-only) + Pro/Team/Enterprise annual.
8. **Low infra cost**: no cloud inference required; BYO API key or local model.

### Non-goals

* Hosting LLM inference (optional future).
* Editing other extensions’ chat boxes directly (not reliably possible).
* Replacing git—Change Report complements git, doesn’t replace it.

---

# 1) Plan tiers and feature gating

## 1.1 Tiers

* **Free**
* **Trial** (2-day Edu “view-only” trial)
* **Pro** (annual, individual)
* **Team** (annual per seat)
* **Enterprise** (annual, seat-based/custom contract; example starting package can be priced at `$999` annually)

## 1.2 Product packaging (final decision)

Single extension, two modules, one account, one entitlement token:

* **Narrate module**
* **PG Memory Bank module**

Purchasing options:

1. **Narrate only**
2. **PG only**
3. **Bundle (Narrate + PG)**

If user later buys another SKU, entitlements merge on the same account (no second login).

## 1.3 Feature matrix

| Feature                                            | Free             | Trial (2 days) | Pro                      | Team                  | Enterprise                          |
| -------------------------------------------------- | ---------------- | -------------- | ------------------------ | --------------------- | ----------------------------------- |
| Dev narration reading mode (full-file)             | ✅                | ✅              | ✅                        | ✅                     | ✅                                   |
| Edu narration reading mode                         | ❌                | ✅ view-only    | ✅                        | ✅                     | ✅                                   |
| Export narration MD                                | ❌                | ❌              | ✅                        | ✅                     | ✅                                   |
| Workspace export                                   | ❌                | ❌              | ✅                        | ✅                     | ✅                                   |
| Change Report (git diff)                           | ❌                | ❌              | ✅                        | ✅                     | ✅                                   |
| Prompt handoff (“Request change”)                  | ✅                | ✅              | ✅                        | ✅                     | ✅                                   |
| Provider controls (BYO/local policy)               | basic            | basic          | basic                    | light org policy      | strict org policy (allow/deny BYO)  |
| Device limit                                       | n/a              | n/a            | 2 devices                | seat-based            | seat-based + admin controls         |
| PG Memory Bank module entitlement                  | optional add-on  | optional add-on | optional add-on or bundle | optional add-on/bundle | optional add-on/bundle              |
| PG projects quota shown as “Projects left”         | 5 projects       | 5 projects      | 20 projects/year (default) | team pool (configurable) | contract-based (high/unlimited)     |
| Referral benefits                                  | ✅                | ✅              | ✅                        | ✅                     | ✅                                   |

**Locked trial rules**

* Trial is **Edu view-only**: no export, no reports, no workspace actions.

## 1.4 Project quota model (UI vs internal)

To avoid confusion for users:

* UI language: **Projects left**
* Internal accounting: can still use a generic credit counter
* 1 project is consumed only on first activation for a unique repo fingerprint
* Reinstalling same repo must not consume a second project

---

# 2) UX / Commands (VS Code)

## 2.1 Commands (Command Palette)

* `Narrate: Toggle Reading Mode (Dev)`
* `Narrate: Toggle Reading Mode (Edu)` (Pro+ or Trial only)
* `Narrate: Switch Narration Mode` (QuickPick: Dev / Edu)
* `Narrate: Export Narration (Current File)` (Pro+)
* `Narrate: Export Narration (Workspace)` (Pro+)
* `Narrate: Generate Change Report (Git Diff...)` (Pro+)
* `Narrate: Request Change (Selection / Symbol / Block)` (Free)
* `Narrate: Sign In`
* `Narrate: Redeem Code`
* `Narrate: License Status`
* `Narrate: Refresh License`
* `Narrate: Manage Devices` (Pro+ / org)
* `Narrate: Start Edu Trial` (only if eligible; triggered on first Edu usage)

## 2.2 Status Bar

* Left status item: `Narrate: Code | Reading (Dev/Edu)`
* Right status item: `Plan: Free/Trial/Pro/Team/Ent (days left)`
* Click opens license status panel.

## 2.3 Reading Mode (virtual document)

* Implement as a **virtual document** using `TextDocumentContentProvider` with a custom URI scheme:

  * `narrate://read?file=<encoded>&mode=dev`
  * `narrate://read?file=<encoded>&mode=edu`
* Behavior:

  * When toggled: open narration view in same editor group.
  * Provide a header with:

    * original file path
    * mode
    * timestamp
    * legend for sections
  * Provide sections + line-locked narrations.

## 2.4 “Request Change” prompt handoff

* User selects text, or cursor is inside a symbol.
* Command opens an input box: “Describe the change you want.”
* Generates a structured prompt (see section 6.3) containing:

  * file path
  * line range
  * code snippet
  * dev/edu narration (if available)
  * constraints: “minimal diff, don’t touch unrelated files, preserve behavior elsewhere”
* UI actions:

  * `Copy Prompt`
  * `Open Chat Panel` (best-effort: show instructions to paste)
  * `Insert narrate:` comment into code (optional helper)

---

# 3) Local storage and caching

## 3.1 Storage location

Use VS Code global storage + workspace storage:

* Global: `${globalStorageUri}/narrate/`
* Workspace: `${workspaceFolder}/.narrate/` (optional, for exports and workspace-level cache if desired)

Recommended:

* Cache in **global storage** by default (fewer repo diffs).
* Exports and reports in workspace `.narrate/exports/` (configurable).

## 3.2 SQLite cache

Bundle a Node SQLite library inside the extension:

* Prefer `better-sqlite3` (native) but bundling native modules is harder.
* Prefer `sqlite3` or `@vscode/sqlite3`-compatible approach.
* If native complexity is too high, use JSONL/LevelDB-style store first, then upgrade.

**Target: SQLite** (as requested), but allow fallback:

* `CacheProvider = SqliteCacheProvider | JsonCacheProvider`.

### Schema (SQLite)

`narration_cache`

* `id` (PK)
* `file_path` (text)
* `repo_root` (text)
* `line_number` (int)
* `line_hash` (text)  // hash(trim(line))
* `block_id` (text)   // optional grouping
* `mode` (text)       // 'dev' | 'edu'
* `narration` (text)
* `tags` (text JSON)
* `model_id` (text)
* `created_at` (timestamp)
* `updated_at` (timestamp)

`file_state`

* `repo_root`
* `file_path`
* `last_seen_hash` (text) // hash of full file content or block map
* `last_narrated_at`

`settings_local`

* `key`
* `value`

## 3.3 Hash strategy

* `line_hash = sha256(normalizeWhitespace(lineText))`
* Reuse cached narration if line_hash matches.
* If the file changes:

  * recompute line hashes
  * for each line:

    * if same hash exists (same file path) reuse
    * else generate narration for that line (or batch lines)

For moved lines: optional improvement

* if hash exists elsewhere in same file, reuse.

## 3.4 Incremental batching

To reduce API calls:

* Batch by section (imports, class header, methods).
* Or batch by chunks of N lines (e.g., 30–80 lines) with per-line outputs.

---

# 4) Narration engine

## 4.1 Backends (model selection)

Support multiple providers:

* **BYO API Key**:

  * OpenAI-compatible
  * OpenRouter (OpenAI-compatible routing endpoint)
  * Anthropic
  * DeepSeek (OpenAI-compatible style)
  * Other OpenAI-compatible gateways (Kimi/Groq/etc.) via base URL
* **Local model**:

  * Ollama/OpenAI-compatible local endpoint ([http://localhost:11434/v1](http://localhost:11434/v1) or similar)

Design as:

* `LLMProvider` interface with implementations:

  * `OpenAICompatibleProvider`
  * `OpenRouterProvider` (or OpenAI-compatible config preset)
  * `AnthropicProvider` (optional)
  * `OllamaProvider` (OpenAI-compatible wrapper)

Users configure:

* provider type
* base URL
* model name
* API key (stored in VS Code SecretStorage)
* max tokens, temperature fixed low

Enterprise policy controls (token-driven):

* allow/deny BYO providers
* allow only approved provider IDs or base URLs
* enforce local-only mode when required
* block outbound provider calls if org policy requires private mode

**Strictness**:

* Temperature ~ 0.0–0.2
* Strong instructions: “do not infer beyond code”

## 4.2 Output contract (must be structured JSON)

The model must return strict JSON per line/block:

### Developer mode output

```json
{
  "mode": "dev",
  "file": "User.java",
  "sections": [
    {
      "title": "Imports",
      "range": {"start": 1, "end": 10},
      "summary": "This section imports external libraries used by the file.",
      "lines": [
        {"n": 1, "text": "Import Spring web annotations so this class can declare HTTP endpoints.", "tags": ["spring","http","annotation"], "depends_on_external": false}
      ]
    }
  ]
}
```

### Edu mode output

Same, but each line includes `edu` expansions:

```json
{
  "mode": "edu",
  "sections": [
    {
      "title": "Imports",
      "range": {"start": 1, "end": 10},
      "summary": "These lines pull in external building blocks so the file can use them.",
      "lines": [
        {
          "n": 1,
          "text": "Import Spring web annotations so this class can declare HTTP endpoints.",
          "edu": "An HTTP endpoint is a web address path (like /users) that your app listens to so other apps can request data. An annotation is a label like @GetMapping that tells Spring how to treat code.",
          "tags": ["http","endpoint","annotation"],
          "depends_on_external": false
        }
      ]
    }
  ]
}
```

**Hard constraints**

* Must not mention frameworks not present.
* If uncertain: set `depends_on_external=true` and say “behavior depends on X definition elsewhere.”

## 4.3 Syntax/jargon progressive explanation (Edu mode)

Rules:

* Explain syntax/jargon **only on first meaningful occurrence per file or section**.
* For closing braces/parentheses-only lines: prefer “end of block started at line X.”
* Keep `edu` additions ~ 25–50 words max.

Implement this with:

* The model can track within a request, but better:
* The extension sends a “knownTerms” list for the file (computed from prior narration tags), and asks model not to re-explain already-known terms.

---

# 5) Reading view rendering format

## 5.1 Display format (virtual doc)

Example layout:

```
NARRATE READING MODE — EDU
File: src/main/java/.../UserController.java
Generated: 2026-02-19 14:12
Plan: Trial (expires in 36h)

SECTION: Imports (lines 1–12)
Summary: These lines pull in external building blocks the file uses.

[1] Import Spring web annotations so this class can declare HTTP endpoints.
// Edu: An HTTP endpoint is a web address path (like /users) that your app listens to...
[2] Import UserService so the controller can delegate business logic.
// Edu: A controller receives web requests; business logic is the rules...
...
SECTION: Class Declaration (lines 13–40)
...
```

### Dev mode shows only the dev line.

### Edu mode shows dev line + `// Edu:` line.

## 5.2 Source code visibility option

Config:

* `narrate.readingView.showCodeLine = true|false`
  If true, show original line faintly:

```
(1) import org.springframework.web.bind.annotation.*;
[1] Import Spring web annotations so this class can declare HTTP endpoints.
```

---

# 6) Change Reports (Pro+)

## 6.1 Source: Git diff

Implement:

* Detect git repo root for current workspace.
* Provide UI to choose diff type:

  * “Uncommitted changes (working tree)”
  * “Staged changes”
  * “Between commits” (select commit A and B)
  * “Since last tag” (optional)

Use `git` CLI via Node `child_process`:

* `git diff`
* `git diff --staged`
* `git log --oneline --max-count=...` for selection

## 6.2 Report output

Write markdown under:

* `.narrate/reports/`
  File name:
* `change-report_YYYY-MM-DD_HHMM.md`

Report structure:

* Header:

  * timestamp
  * repo
  * diff base
  * plan and user
* “Files Changed” summary table:

  * file path
  * added/removed lines count
* For each file:

  * “Added”, “Removed”, “Modified”
  * Provide line ranges and narration meaning.

Example snippet:

```md
## File: src/.../UserController.java

### Added
[+41] Added @GetMapping("/users") // Adds an HTTP endpoint that listens on /users.

### Removed
[-12] Removed import com.foo.LegacyAuth; // Removed old authentication dependency.

### Modified
[~88] Changed validation rule from X to Y // Now rejects empty names before calling service.
```

Narration for diff lines:

* Use cached narration if possible.
* Otherwise generate dev narration for those lines on demand.
* For Edu: Pro+ only.

## 6.3 “AI-change risk” note (optional)

Add a section at end:

* top N files touched
* large diffs warning

---

# 7) Trial, refund, and anti-abuse rules

## 7.1 Edu trial (2-day)

* Free users: Dev view only.
* If user tries to open Edu view:

  * if no trial used and user is signed in -> start trial
  * else if trial expired -> prompt upgrade

Trial policy:

* `trial_duration = 48 hours`
* Trial includes:

  * Edu reading view only
* Trial excludes:

  * Edu export
  * change reports
  * workspace export

Server fields:

* `trial_started_at`, `trial_expires_at`

Token claim:

* `trial_expires_at` included so extension can check offline.

## 7.2 Refund policy (7-day)

* Refund allowed within 7 days of purchase (Pro/Team/Ent).
* All paid plans are **annual** (no lifetime license).
* Refund requires user to be online and signed in.
* When refund approved:

  * set `revoked=true`
  * revoke active device tokens
  * then issue refund externally

Anti-offline abuse:

* During first 7 days after purchase: token validity is **24 hours** (must refresh daily).
* After refund window: token validity can be 14–30 days.

Token claims:

* `purchase_at`
* `refund_window_ends_at`
* `token_max_ttl_hours` (server-controlled)

## 7.3 Project quota consumption rules

* Quota is displayed as “Projects left”.
* One project is consumed only on first activation of a unique repo fingerprint.
* Reinstalling same repo must be idempotent (no second consumption).
* If subscription period renews, quota resets according to plan.
* Manual/admin quota adjustments must be audit logged.

---

# 8) Licensing and backend (minimal cloud)

## 8.1 Backend stack recommendation

Use **Node.js (NestJS)** since that matches your ecosystem, and Postgres as requested.

* API: NestJS + Fastify
* DB: Postgres + Prisma
* Auth: email magic link + optional GitHub OAuth
* Rate limiting: Redis (optional) or simple in-memory + Cloudflare
* Hosting:

  * Small VPS (Hetzner) behind **Cloudflare** (recommended)
  * Or serverless later (Cloudflare Workers) if needed, but Nest on VPS is fine.

For “millions of users”:

* Most operations are low QPS:

  * activation/refresh a few times per user per month
* Scale by:

  * Cloudflare caching for static pages
  * Horizontal scaling later
  * DB indexing and connection pooling

## 8.2 Core DB tables (Postgres)

### `users`

* `id` UUID PK
* `email` text unique nullable
* `github_id` text unique nullable
* `created_at`
* `last_login_at`

### `plans`

* `id` (`free`, `pro`, `team`, `enterprise`)
* `name`
* `billing_period` (annual)
* `price_cents`
* `features_json`

### `subscriptions`

* `id` UUID
* `user_id`
* `plan_id`
* `status` (active, expired, revoked, refunded)
* `starts_at`
* `ends_at`
* `revoked_at` nullable
* `refund_window_ends_at`
* `source` (stripe, offline)
* `created_at`

### `product_entitlements`

Single account can hold one or both modules.

* `id` UUID
* `user_id`
* `narrate_enabled` bool
* `memorybank_enabled` bool
* `bundle_enabled` bool
* `starts_at`
* `ends_at`
* `status` (active, expired, revoked, refunded)
* `created_at`

### `project_quotas`

UI shows this as “Projects left”.

* `id` UUID
* `user_id`
* `scope` (`memorybank`, future extensible)
* `period_start`
* `period_end`
* `projects_allowed`
* `projects_used`
* `updated_at`

### `project_activations`

Consumes project quota once per unique project fingerprint.

* `id` UUID
* `user_id`
* `scope` (`memorybank`)
* `repo_fingerprint` (unique with `user_id` + `scope`)
* `repo_label` nullable
* `first_activated_at`
* `last_seen_at`

### `devices`

* `id` UUID
* `user_id`
* `install_id` text
* `device_label` text nullable
* `last_seen_at`
* `revoked_at` nullable

### `entitlement_tokens` (optional, can be stateless)

* `jti` UUID
* `user_id`
* `install_id`
* `issued_at`
* `expires_at`
* `revoked_at`

### `trial`

* `user_id`
* `trial_started_at`
* `trial_expires_at`

### Offline payments

`offline_payment_refs`

* `id` UUID
* `email`
* `ref_code` unique
* `amount_cents`
* `status` (pending, approved, rejected)
* `proof_url` nullable
* `expires_at`
* `created_at`
* `approved_at`

`redeem_codes`

* `code` unique
* `email`
* `plan_id`
* `module_scope` (`narrate`, `memorybank`, `bundle`)
* `projects_allowed` nullable
* `status` (unused, used, revoked)
* `used_at`
* `created_at`

### Referrals

`affiliate_codes`

* `user_id`
* `code` unique
* `commission_rate_bps`
* `status` (active, paused)

`affiliate_conversions`

* `id`
* `affiliate_user_id`
* `buyer_user_id`
* `ref_code`
* `status` (clicked, registered, paid_confirmed, refunded)
* `order_id`
* `gross_amount_cents`
* `commission_amount_cents`
* `confirmed_at` nullable
* `created_at`

`affiliate_payouts`

* `id`
* `affiliate_user_id`
* `period_start`
* `period_end`
* `amount_cents`
* `status` (pending, approved, paid, rejected)
* `payout_reference` nullable
* `paid_at` nullable

Commission logic:

* Commission only on `paid_confirmed` and non-refunded orders
* Configurable hold period before payout (anti-fraud)
* Optional bonus project credits for referrer can coexist with cash commission

## 8.3 Token format

Use a signed JWT (ECDSA recommended, RSA acceptable).
Claims:

* `sub` userId
* `install_id`
* `plan`
* `features`
* `modules` (`narrate`, `memorybank`, `bundle`)
* `projects_allowed`
* `projects_used`
* `trial_expires_at`
* `refund_window_ends_at`
* `token_max_ttl_hours`
* `provider_policy` (allowed/blocked providers, BYO policy, local-only flag)
* `exp`

Client verifies signature offline using embedded public key.

## 8.4 API endpoints

Auth:

* `POST /auth/email/start`
* `POST /auth/email/verify`
* `GET /auth/github/start`
* `GET /auth/github/callback`

Catalog:

* `GET /catalog/plans`
* `GET /catalog/modules`

Trial:

* `POST /trial/start`

Entitlement:

* `POST /entitlement/activate` (license/redeem/login -> binds install)
* `POST /entitlement/refresh`
* `GET /entitlement/status`
* `POST /devices/list`
* `POST /devices/revoke`
* `POST /projects/activate` (idempotent by repo fingerprint)
* `GET /projects/quota`

Payments:

* `POST /payments/stripe/webhook`
* `POST /payments/offline/create-ref`
* `POST /payments/offline/submit-proof`
* `POST /redeem/apply`

Refund:

* `POST /refund/request`
  Admin:
* `POST /admin/refund/approve`
* `POST /admin/offline/approve`
* `POST /admin/offline/reject`

Affiliates:

* `POST /affiliate/code/create`
* `POST /affiliate/track-click`
* `POST /affiliate/conversion/confirm`
* `GET /affiliate/dashboard`
* `POST /admin/affiliate/payout/approve`

## 8.5 MVP boundary and add-ons

MVP (ship first):

* Narrate core features
* Licensing, annual plans, project quota gating
* Stripe + offline payment + redeem flow
* Referral/affiliate accounting

Post-MVP add-ons:

* WhatsApp/Telegram remote command orchestration
* Dedicated mobile companion app
* Cloud dashboards beyond core license and payout pages

---

# 9) VS Code extension implementation details (TypeScript)

## 9.1 Repo structure

```
narrate/
  extension/
    package.json
    tsconfig.json
    src/
      extension.ts
      commands/
        toggleReadingMode.ts
        exportNarrationFile.ts
        exportNarrationWorkspace.ts
        generateChangeReport.ts
        requestChangePrompt.ts
        authSignIn.ts
        redeemCode.ts
        licenseStatus.ts
        refreshLicense.ts
      readingView/
        narrateSchemeProvider.ts
        renderNarration.ts
        sectionBuilder.ts
      narration/
        narrationEngine.ts
        promptTemplates.ts
        outputValidator.ts
        termMemory.ts
      llm/
        provider.ts
        openAICompatibleProvider.ts
        openRouterProvider.ts
        anthropicProvider.ts (optional)
        config.ts
      cache/
        cacheProvider.ts
        sqliteCacheProvider.ts
        jsonCacheProvider.ts
        hashing.ts
      git/
        gitClient.ts
        diffParser.ts
      licensing/
        entitlementClient.ts
        tokenVerifier.ts
        secretStorage.ts
        plans.ts
        featureGates.ts
        projectQuota.ts
      integrations/
        memoryBankBridge.ts
      utils/
        fs.ts
        path.ts
        debounce.ts
        logger.ts
  server/
    (separate repo or folder)
  cli/
    (optional future)
```

## 9.2 Key modules

* `narrateSchemeProvider.ts`

  * Implements `TextDocumentContentProvider`
  * Builds narration on demand via cache + engine
* `narrationEngine.ts`

  * Reads file content
  * Builds sections (imports/classes/methods)
  * Determines which lines need narration (cache miss)
  * Calls LLM provider in batches
  * Validates JSON output
  * Stores results in cache
* `outputValidator.ts`

  * Ensures JSON schema is correct
  * Rejects hallucinated references:

    * e.g., if output mentions “database table X” not present, flag and regenerate with stricter prompt
* `featureGates.ts`

  * Checks entitlement and trial logic:

    * canUseEduView
    * canExport
    * canChangeReport
    * canUseMemoryBank
* `projectQuota.ts`

  * Resolves projects allowed/used from token + refresh endpoint
  * Handles repo fingerprint checks and idempotent activation
* `entitlementClient.ts`

  * Activate/refresh tokens
  * Handles offline tokens + refresh schedule
  * Enforces provider policy in enterprise mode (allowlist/denylist/BYO rules)
* `gitClient.ts` + `diffParser.ts`

  * Runs git diff and parses hunks by file
  * Maps added/removed lines into report sections
* `memoryBankBridge.ts`

  * Calls local PG commands only when entitlement allows Memory Bank module
  * Bridges Narrate account entitlements with installed Memory-bank scripts

## 9.3 SQLite bundling

If native module bundling is hard for the first milestone:

* start with `jsonCacheProvider` stored in global storage
* keep interface stable so SQLite can be swapped in later
* then upgrade to SQLite once stable

But your final target is SQLite.

---

# 10) Example inputs and expected outputs (for Codex)

## 10.1 Example code snippet

### Java (imports + endpoint)

```java
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {
  @GetMapping("/users")
  public String listUsers() {
    return "ok";
  }
}
```

### Developer narration output (example)

* `[1] Import the GetMapping annotation so methods can declare HTTP GET routes.`
* `[2] Import RestController so Spring treats this class as a web controller returning JSON/text responses.`
* `[4] Mark this class as a REST controller so Spring registers it and handles web requests here.`
* `[6] Declare a GET endpoint at /users so clients can request the user list.`
* `[7] Define a method that returns a string response.`
* `[8] Return the literal string "ok" as the response body.`

### Edu narration output (example)

* `[1] Import GetMapping so you can label a method as a web address that responds to “GET” requests. // GET is the common “read data” web request type.`
* `[2] Import RestController so Spring knows this class handles web requests. // An annotation is a label starting with @ that tells the framework what to do.`
* `[4] @RestController tells Spring to register this class as a request handler. // “Controller” is like the receptionist: it receives requests and calls the right logic.`
* `[6] @GetMapping("/users") means: when someone visits /users, run this method.`
* `[7] This method returns text.`
* `[8] It returns "ok", which becomes the response content.`

## 10.2 Example “Request Change” prompt format

Generated prompt:

```
You are editing a codebase. Apply the smallest possible change.

File: src/main/java/.../UserController.java
Target lines: 6–9

Current code:
@GetMapping("/users")
public String listUsers() {
  return "ok";
}

Current meaning (dev):
- This defines a GET endpoint at /users and returns "ok".

Change request:
- Change the endpoint path from "/users" to "/customers".
- Do not modify any other files unless strictly necessary.
- Keep method behavior the same.

Output:
- Provide a unified diff patch only.
```

---

# 11) Build milestones (implementation order)

## Milestone 1 — Narrate MVP (no licensing yet)

* Dev reading mode (virtual document)
* Basic narration engine (JSON contract) with one provider (OpenAI-compatible)
* Local cache (JSON first)
* Prompt handoff command

## Milestone 2 — Edu mode + section summaries

* Edu narration rendering
* Progressive jargon/syntax expansions
* Section builder improvements

## Milestone 3 — Exports (Pro gating placeholder)

* Export current file MD
* Workspace export (optional later)
* Basic gates (stub)

## Milestone 4 — Change Report (Git diff)

* Parse git diffs
* Generate report MD
* Use cache narration for diff lines

## Milestone 5 — Licensing backend + trial + refund

* Auth (email)
* Trial start + 48h claim
* Subscription tables
* Entitlement token issue/refresh + installId binding
* Module entitlements (Narrate only / PG only / Bundle)
* Project quota model (Projects left) + idempotent project activation
* Pro device limits
* Refund window + 24h token TTL in first 7 days

## Milestone 6 — Payments (Stripe + offline)

* Stripe webhook -> subscription active
* Offline payment refs + manual admin approvals -> redeem codes
* Annual pricing enforcement (no lifetime SKU)
* Affiliate/referral commission tracking + payout workflow

## Milestone 7 — Team/Enterprise

* Seat management + admin devices
* Policy controls in token (local-only/BYO allowed/blocked)
* Enterprise provider governance (allowlist/denylist for OpenRouter/BYO/local)

## Milestone 8 — SQLite cache upgrade

* Replace JSON cache with SQLite provider (keep interface stable)

## Milestone 9 — Remote command add-on (Phase 2, separate from MVP)

* Telegram/WhatsApp bot command intake
* Secure cloud job queue + signed short-lived jobs
* Local daemon on developer machine to execute approved commands
* Mobile summary notifications (changed files + result)
* Explicitly out-of-scope for MVP launch of Narrate core

---

# 12) Notes for integrating PG Memory Bank (do not build it here)

Commercial integration decisions:

* Single extension + single account + single entitlement token.
* Module flags in token decide access:
  * `narrate_enabled`
  * `memorybank_enabled`
  * `bundle_enabled`
* Project-based quota exposed to user as **Projects left**:
  * Free baseline: `5 projects`
  * Pro baseline: `20 projects/year`
  * Team: pooled quota (configurable)
  * Enterprise: contract-based (high/unlimited)
* Narrate backend should include `features.memorybank=true` and project quota claims.
* Memory Bank runtime should be local-first; backend is used for entitlement, quota activation, and policy only.
* Integration should reuse existing local PG scripts (`pg install/start/status/end`) instead of rewriting Memory Bank core from scratch.
* Installing/refreshing an already-activated repo must be idempotent (no extra project consumption).

Packaging behavior:

* Users can buy Narrate only, PG only, or Bundle.
* Later purchases merge into same account entitlements.
* No lifetime licenses; annual products only.

(Narrate spec stops here; Memory Bank implementation is separate.)

---

# 13) Deployment recommendations (minimal but scalable)

## Backend

* NestJS + Postgres + Prisma
* Run on Hetzner
* Keep entitlement/quota/affiliate decision logic server-side (do not ship private business logic in extension)
* Put Cloudflare in front for:

  * DDoS protection
  * rate limiting
  * caching static marketing pages
* Use PgBouncer if needed for scaling DB connections.

## Extension distribution

* VS Code Marketplace for public release
* Private builds for internal/student testing
* For enterprise: allow offline install package if requested.

---

If you want, I can also output:

* exact Prisma schema
* exact JWT claim structure
* exact prompt templates (dev/edu) that are strict and non-hallucinating
* exact `package.json` contributions block for VS Code commands, views, settings
