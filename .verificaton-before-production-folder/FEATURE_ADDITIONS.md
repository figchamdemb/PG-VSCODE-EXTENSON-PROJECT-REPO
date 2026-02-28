# Feature Additions for ProdGuard VS Code Extension
## Real Gaps That AI Can Solve But Nobody Has Built

Based on Stack Overflow 2025 survey: 66% of developers say their #1 frustration is AI code that is "almost right but not quite." 45% say debugging AI-generated code takes longer than writing it themselves. Trust in AI accuracy dropped from 40% to 29% in one year. These are the gaps.

---

## 1. AI CODE TRUST SCORE (Nobody does this. Massive gap.)

**The problem:** Developers paste AI-generated code and have no idea if it's good. 66% say it's "almost right but not quite." They ship it anyway because checking manually takes too long.

**What you build:** A real-time trust indicator in the status bar. Every time the developer saves a file or pastes code, the extension scans it silently and shows a score.

```
Status bar: 🟢 Trust: 94/100  |  🟡 Trust: 67/100  |  🔴 Trust: 31/100
```

When they click it, a panel shows exactly WHY:

```
Trust Score: 67/100
─────────────────
✅ No hardcoded secrets
✅ TypeScript types present
⚠️ Empty catch block at line 42 (silent error swallowing)
⚠️ Function at line 18 has 34 lines (max recommended: 20)
❌ No input validation on user data at line 55
❌ Uses deprecated API: findDOMNode() — removed in React 19
```

**Why this is a gap:** Copilot, Cursor, and every AI tool generates code. NONE of them tell you how trustworthy the output is. They just generate and move on. Your extension is the quality gate between AI output and production.

**Cost to build:** Near zero. You already have the scanners from ProdCheck. Just make them run on file save instead of on command.

**Pricing tie-in:** Free tier gets basic trust score (LOC, console.log, empty catches). Pro gets full security + architecture checks.

---

## 2. "EXPLAIN LIKE I BUILT IT" — Codebase Tour Generator

**The problem:** A developer joins a new team. The codebase has 200 files. There is zero documentation. They spend 2-3 weeks just understanding the architecture before they can contribute. This happens at every company, every time someone changes jobs.

**What you build:** One command: `ProdGuard: Generate Codebase Tour`

The extension scans the entire project and generates an interactive, clickable walkthrough:

```
📁 YOUR PROJECT ARCHITECTURE
═══════════════════════════

1. ENTRY POINT
   → src/app/layout.tsx (root layout — wraps all pages)
   → src/app/page.tsx (homepage)

2. API LAYER (14 endpoints found)
   → src/app/api/auth/[...nextauth]/route.ts (authentication)
   → src/app/api/orders/route.ts (GET list, POST create)
   → src/app/api/orders/[id]/route.ts (GET detail, PUT update, DELETE)
   Click any endpoint to see its request/response shape.

3. DATABASE (Prisma + PostgreSQL)
   → prisma/schema.prisma (7 models detected)
   → User → Order → OrderItem → Product (relationship map)
   → Migration history: 12 migrations applied

4. AUTH FLOW
   → NextAuth with Google + Email providers
   → Session stored in database
   → Protected routes: /dashboard/*, /admin/*

5. STATE MANAGEMENT
   → No global state library (uses React Server Components)
   → Client state: React Hook Form for forms
   → Server state: Server Actions (no React Query)

6. POTENTIAL ISSUES DETECTED
   → ⚠️ No error.tsx in /app/dashboard (unhandled errors)
   → ⚠️ No loading.tsx in /app/orders (no loading state)
   → ❌ API route /api/admin has no auth check
```

**Why this is a gap:** Documentation tools exist (JSDoc, Storybook). Codebase explanation exists in Copilot Chat. But NOBODY generates a structured architectural tour that a new developer can follow like a guide. This is the difference between "ask the AI random questions" and "here is your guided onboarding."

**Cost to build:** You already have file discovery and stack detection. Add relationship mapping (trace imports) and endpoint detection (scan route files). Medium effort. High value.

**Pricing tie-in:** Free tier generates a basic file tree with annotations. Pro generates the full interactive tour with relationship maps and issue detection.

---

## 3. DEAD CODE CEMETERY — Find and Bury Unused Code

**The problem:** After 6 months of AI-assisted development, projects accumulate massive amounts of dead code. Unused components, unreachable functions, orphaned files. Nobody cleans up because nobody knows what's safe to delete.

**What you build:** A command that identifies truly dead code:

```
🪦 DEAD CODE REPORT
═══════════════════

DEFINITELY DEAD (safe to delete):
  → src/components/OldHeader.tsx — not imported anywhere
  → src/utils/legacyFormat.ts — not imported anywhere
  → src/hooks/useDeprecatedAuth.ts — not imported anywhere
  Total: 847 lines of dead code across 12 files

PROBABLY DEAD (imported but never rendered/called):
  → src/components/BetaBanner.tsx — imported in 1 file but JSX is commented out
  → src/services/analyticsV1.ts — imported but all calls are behind `if (false)`

ZOMBIE CODE (runs but does nothing useful):
  → src/middleware.ts line 23-45: catch block that only logs, never handles
  → src/api/webhook/route.ts: POST handler returns 200 but does nothing

[🗑️ Clean Up] — Creates a branch, deletes dead files, runs tests to verify
```

**Why this is a gap:** Tree-shaking exists for bundlers. ESLint has no-unused-vars. But NOBODY does whole-project dead code analysis at the file and function level with a one-click cleanup. This is especially painful for AI-generated projects where developers asked the AI to build 5 different versions of a component and kept all of them.

**Cost to build:** Parse all import statements, build a dependency graph, find files with zero inbound imports. Simple graph traversal. Low effort.

**Pricing tie-in:** Free shows the report. Pro offers the one-click cleanup with test verification.

---

## 4. ENVIRONMENT DOCTOR — Fix .env Chaos in 30 Seconds

**The problem:** Every developer has experienced this: clone a repo, run `npm run dev`, and it crashes because you're missing 8 environment variables that nobody documented. Or worse — production breaks because someone forgot to add a new env var to the deployment.

**What you build:** Automatic environment variable management:

```
🩺 ENVIRONMENT DOCTOR
═════════════════════

MISSING (your code references these but they're not in .env):
  → DATABASE_URL — used in prisma/schema.prisma
  → NEXTAUTH_SECRET — used in src/app/api/auth
  → STRIPE_SECRET_KEY — used in src/lib/stripe.ts
  → RESEND_API_KEY — used in src/lib/email.ts

UNUSED (in .env but never referenced in code):
  → OLD_API_KEY — not used anywhere
  → LEGACY_DB_URL — not used anywhere

EXPOSED (should NOT be public):
  → ⚠️ NEXT_PUBLIC_STRIPE_SECRET — secret key exposed to browser!

MISSING FROM .env.example:
  → DATABASE_URL, NEXTAUTH_SECRET, STRIPE_SECRET_KEY
  → [Generate .env.example] — auto-creates with placeholder values

TYPE MISMATCH:
  → PORT=three — expected number, got string
```

**Why this is a gap:** dotenv exists. env-checker packages exist. But NONE of them scan your actual code to find every place env vars are referenced, cross-reference with what's actually in your .env file, check for security exposure, AND generate the .env.example. This is 10 minutes of manual work every time someone sets up a project, multiplied by every developer on the team.

**Cost to build:** Regex scan all files for `process.env.X`, `import.meta.env.X`, `os.environ`, etc. Compare against .env file contents. Very low effort.

**Pricing tie-in:** Free always. This is your "hook" feature that gets every developer to install the extension. Then they discover the paid features.

---

## 5. API CONTRACT VALIDATOR — Does Your Frontend Match Your Backend?

**The problem:** Frontend developer calls `POST /api/orders` with `{ customerId, items }`. Backend expects `{ customer_id, line_items }`. Nobody catches this until runtime. The frontend team and backend team are using different field names, different types, different response shapes. This is the #1 source of integration bugs.

**What you build:** The extension reads your API routes (or OpenAPI spec) and your frontend fetch calls, then checks if they match:

```
🔌 API CONTRACT CHECK
═════════════════════

POST /api/orders
  Backend expects: { customer_id: string, line_items: array, payment_method: string }
  Frontend sends:  { customerId: string, items: array }
  
  MISMATCHES:
  ❌ Field name: customer_id (backend) vs customerId (frontend)
  ❌ Field name: line_items (backend) vs items (frontend)
  ❌ Missing field: payment_method (frontend never sends this)

GET /api/users/:id
  Backend returns: { id, name, email, role, createdAt }
  Frontend uses:   { id, name, email, avatar }
  
  MISMATCHES:
  ⚠️ Frontend reads 'avatar' but backend doesn't return it
  ⚠️ Backend sends 'role', 'createdAt' but frontend ignores them
```

**Why this is a gap:** TypeScript helps if both sides share types. OpenAPI generators help if you have a spec. But most projects DON'T have shared types or an OpenAPI spec. And AI generates frontend and backend code separately, so mismatches are extremely common. Nobody does automatic cross-layer contract validation by reading both sides of the code.

**Cost to build:** Parse API route files for request/response shapes. Parse frontend fetch/axios calls for what they send. Compare. Medium effort but very high value.

**Pricing tie-in:** Pro feature. This saves hours of debugging per week for full-stack teams.

---

## 6. TECH DEBT COUNTER — Show the Cost in Real Money

**The problem:** Developers know there's tech debt. Managers don't care because they can't see it. The conversation always goes: "We need to refactor X." "Why? It works." "It's tech debt." "Later."

**What you build:** A sidebar widget that translates tech debt into money:

```
💰 TECH DEBT DASHBOARD
═══════════════════════

This project's estimated tech debt: $4,200/month

Breakdown:
  Empty catch blocks (23)        → ~$800/mo (silent bugs, 3hr avg debug time)
  Files over 500 LOC (7)         → ~$600/mo (slower feature development)
  No test coverage on /api/*     → ~$1,200/mo (manual testing time)
  Hardcoded magic numbers (45)   → ~$400/mo (confusion during changes)
  Copy-pasted code blocks (12)   → ~$700/mo (fix bugs in multiple places)
  Missing error boundaries (4)   → ~$500/mo (user-facing crashes)

Trend: ↑ 12% from last month

[📊 Generate Report for Manager] — PDF with costs and fix recommendations
```

**Why this is a gap:** SonarQube measures tech debt in "hours to fix." That means nothing to a non-technical manager. Translating it to DOLLARS makes the conversation instantly actionable. "We're burning $4,200/month on preventable issues" gets budget approval. "We have 340 hours of tech debt" gets ignored.

**Cost to build:** You already detect these issues with ProdCheck. Add a cost multiplier per issue type (based on industry averages for debugging time). Simple math. Low effort.

**Pricing tie-in:** Free shows the total number. Pro shows the dollar breakdown and generates the manager-ready PDF report.

---

## 7. ONE-CLICK PROJECT SETUP — "Just Make It Work"

**The problem:** Starting a new project takes 30-60 minutes of configuration. ESLint, Prettier, TypeScript, Husky pre-commit hooks, CI/CD, folder structure, environment setup. AI can generate boilerplate but configures it wrong half the time (wrong ESLint rules, incompatible Prettier version, missing TypeScript paths).

**What you build:** One command: `ProdGuard: Initialize Project Standards`

```
Pick your stack:  [Next.js + Prisma + TypeScript]
Pick your style:  [ProdGuard Standard] (our coding standards)

Creating project scaffolding...
  ✅ ESLint configured (with ProdGuard rules)
  ✅ Prettier configured (compatible with ESLint)
  ✅ TypeScript strict mode enabled
  ✅ Husky pre-commit hooks installed
  ✅ ProdCheck runs on every commit (blocks if blockers found)
  ✅ Folder structure created:
     src/app/ (routes)
     src/components/ (UI)
     src/lib/ (server logic)
     src/hooks/ (custom hooks)
     src/types/ (TypeScript types)
  ✅ .env.example generated
  ✅ .gitignore configured
  ✅ VS Code settings.json configured

Your project is production-ready from line 1.
```

**Why this is a gap:** create-next-app, nest new, spring init all create basic boilerplate. But NONE of them set up the full quality pipeline (linting + formatting + pre-commit + production checks + folder conventions) in one command. Developers spend their first day configuring tools instead of building features.

**Cost to build:** Template files + a setup script. Very low effort because you already have all the standards defined.

**Pricing tie-in:** Free always. This locks developers into the ProdGuard ecosystem from project start.

---

## 8. COMMIT MESSAGE QUALITY GATE

**The problem:** Git history looks like: "fix", "update", "wip", "stuff", "asdfgh", "please work". When something breaks in production and you need to trace which commit caused it, the history is useless.

**What you build:** A pre-commit hook that validates commit messages AND summarizes what actually changed:

```
Attempted commit: "fix stuff"

🚫 REJECTED — Commit message does not meet standards.

What you actually changed:
  → Modified: src/services/order.service.ts (fixed null check on line 45)
  → Modified: src/api/orders/route.ts (added pagination parameter)
  → Added: src/utils/paginate.ts (new pagination utility)

Suggested commit messages:
  1. "fix(orders): add null check in OrderService.findById"
  2. "feat(orders): add pagination to GET /api/orders"
  
Pick one or write your own (following conventional commits format):
```

**Why this is a gap:** Commitlint exists for format validation. AI commit message generators exist. But NOBODY combines rejection + analysis + intelligent suggestion in one flow. The developer doesn't have to think about the message — the tool reads the diff and suggests the right one.

**Cost to build:** Parse git diff, categorize changed files, generate message template. Low effort.

**Pricing tie-in:** Free. Another hook feature that makes the extension indispensable.

---

## PRIORITY RANKING: What to Build First

| # | Feature | Effort | Value | Build First? |
|---|---------|--------|-------|-------------|
| 4 | Environment Doctor | Very Low | Very High | ✅ YES — free hook, every dev needs it |
| 1 | AI Trust Score | Low | Very High | ✅ YES — unique differentiator, uses existing scanners |
| 8 | Commit Quality Gate | Low | High | ✅ YES — free hook, daily use |
| 3 | Dead Code Cemetery | Low | High | ✅ YES — visible, satisfying results |
| 7 | One-Click Setup | Low | High | ✅ YES — locks users into ecosystem |
| 6 | Tech Debt Counter ($) | Low | Medium-High | Build in month 2 — needs calibration |
| 2 | Codebase Tour | Medium | Very High | Build in month 2 — impressive demo |
| 5 | API Contract Validator | Medium | Very High | Build in month 3 — complex parsing |

**Month 1:** Ship features 4, 1, 8, 3, 7 — all low effort, immediate value
**Month 2:** Ship features 6, 2 — impressive, demo-worthy, drives upgrades
**Month 3:** Ship feature 5 — enterprise killer feature, complex but differentiated

---

## THE FULL EXTENSION BUNDLE (What You Sell)

```
PRODGUARD VS CODE EXTENSION
════════════════════════════

FREE (Hook them):
├── Environment Doctor (find missing, unused, exposed env vars)
├── AI Trust Score (basic: LOC, console.log, empty catches)
├── Commit Quality Gate (reject bad messages, suggest good ones)
├── Dead Code Report (show what's dead, no auto-delete)
├── Project Setup (initialize with ProdGuard standards)
└── ProdCheck Basic (5 scans/month)

PRO — $10/year student, $19/month developer:
├── Everything in Free, PLUS:
├── AI Trust Score (full: security, architecture, dependencies)
├── Dead Code Cleanup (one-click delete + test verification)
├── Codebase Tour Generator (interactive architecture walkthrough)
├── Tech Debt Counter (dollar amounts + manager PDF report)
├── ProdCheck Unlimited (full 17-checklist scanning)
└── Coding Standards Enforcement (templates + auto-reject)

ENTERPRISE — $99-299/month per team:
├── Everything in Pro, PLUS:
├── API Contract Validator (cross-layer type checking)
├── PG Life Monitoring Agent (24/7 production monitoring)
├── Encrypted Offline Mode (zero data leaves network)
├── Custom Rule Creation (add your own coding standards)
├── Team Dashboard (trends, scores, tech debt across projects)
├── CI/CD Integration (GitHub Actions blocker)
└── Slack/Teams Notifications
```

Every free feature solves a real, daily pain point. Every paid feature saves real money. The upgrade path is natural: developers use the free tools daily, hit the limits, see the value, and upgrade.

---

## 2026-02-23 Product Fit Decision (Core vs Standalone)

This section is the practical split to avoid over-engineering and keep cost low.

### A) Build Inside Current ProdGuard Extension (Core Roadmap)

| Feature | Keep in Current Product? | Why |
|---|---|---|
| Environment Doctor | Yes (Free, core) | Highest daily value, lowest build cost, perfect local-first fit, no external API needed. |
| AI Trust Score | Yes (Free basic + Pro full) | Core differentiator tied directly to existing policy scanners and `pg prod` trust model. |
| Commit Message Quality Gate | Yes (Free, core) | Natural extension of `PG Push` and pre-push quality workflow. |
| Command Help Center | Yes (Free, core) | Removes onboarding friction: exact commands, expected outputs, and troubleshooting for `pg` + Slack governance flow. |
| API Contract Validator | Yes (Team/Enterprise module) | Strong enterprise value, directly supports "AI almost right" integration failures. |
| Codebase Tour Generator | Yes (Pro module, after core gates) | Fits Narrate mission (understand code quickly) and onboarding use case. |

### B) Defer / Spin Out as Separate Extension(s) First

| Feature | Standalone First? | Why |
|---|---|---|
| Dead Code Cemetery | Yes (separate "cleanup" extension) | Valuable but tangential; can grow independently without bloating core governance runtime. |
| One-Click Project Setup | Yes (separate "bootstrap" extension/CLI) | High maintenance across frameworks; better as independent template product. |
| Tech Debt Counter ($) | Yes (separate reporting add-on) | Requires calibration/manager reporting UX; better as dashboard-oriented product module. |

### C) Cost-Control Rule

1. Keep Free/Student features deterministic and local-first.
2. Reserve cloud-heavy analysis for Team/Enterprise scopes.
3. Do not add features to core that require constant framework-template maintenance unless they directly improve trust/safety.

### D) Delivery Order (post current enforcement milestones)

1. Environment Doctor
2. AI Trust Score
3. Commit Message Quality Gate
4. Command Help Center (Quickstart + Troubleshooting)
5. Codebase Tour Generator
6. API Contract Validator
7. Standalone spin-outs (Cleanup, Bootstrap, Debt Dashboard)

---

## 2026-02-24 Technical Draft (MVP Specs)

This is the build draft to convert high-value features into implementation tickets.

### 1) AI Trust Score (Core, Milestone 14B)

#### Goal
- Show a deterministic trust signal for AI-written code, tied to policy enforcement results.
- Reuse existing policy engines so score is explainable, not "AI opinion."

#### Inputs (v1)
- Dependency policy findings (`/account/policy/dependency/verify`).
- Coding standards findings (planned policy endpoint; same rule-ID style).
- Local static quick checks (empty catch, `console.log`, oversized function/file, missing input validation markers).

#### Scoring model (v1 deterministic)
- Start at `100`.
- For each blocker: `-15`.
- For each warning: `-4`.
- Hard floor `0`, hard ceiling `100`.
- If any blocker exists: status color forced to red.

#### Severity bands
- `85-100`: green (ship-ready baseline)
- `60-84`: yellow (needs review)
- `0-59`: red (do not ship)

#### Output contract (internal)
```json
{
  "score": 72,
  "status": "yellow",
  "summary": { "blockers": 1, "warnings": 7 },
  "findings": [
    { "rule_id": "STD-CTRL-001", "severity": "blocker", "file": "src/controllers/order.ts", "line": 88, "message": "Controller has business logic." }
  ]
}
```

#### UI
- VS Code status bar:
  - `Trust: 94/100` (green)
  - `Trust: 67/100` (yellow)
  - `Trust: 31/100` (red)
- Click opens findings panel grouped by blocker/warning with rule IDs and fix hints.

#### Acceptance criteria
- Save file triggers score refresh in < 1.5s for changed-file mode.
- Full project recalculation command available.
- Every score drop is traceable to explicit findings/rule IDs.

---

### 2) Commit Message Quality Gate (Core, Milestone 14C)

#### Goal
- Prevent low-quality commit history and auto-suggest good commit messages from real diff content.

#### Guard rules (v1)
- Reject generic messages (`fix`, `update`, `wip`, `test`, `asdf`, etc.).
- Require conventional commit format:
  - `type(scope): summary`
  - allowed types: `feat|fix|refactor|docs|test|chore|perf|build|ci`
- Require minimum summary quality:
  - >= 10 chars
  - not only ticket number

#### Diff-aware suggestion flow
- Parse staged diff.
- Detect primary scope from changed paths.
- Generate top 2 message suggestions.

#### Integration points
- `PG Push` pre-commit prompt in extension.
- Optional CLI hook mode for team repos.

#### Acceptance criteria
- Generic commit text is blocked with clear reason.
- Suggestion quality improves over baseline generic title.
- User can still provide manual custom message if valid.

---

### 3) API Contract Validator (Core Team/Enterprise, Milestone 15B)

#### Goal
- Detect frontend/backend payload mismatches before runtime.

#### Source priority
1. OpenAPI/Swagger spec (`openapi.json|yaml`) if present.
2. Backend route inference (framework parser fallback).
3. Shared schema files (Zod/DTO/interfaces) when discoverable.

#### Frontend extraction (v1)
- Parse `fetch(...)`, `axios.*(...)`, and common API client wrappers.
- Extract method, path, request payload keys, and response-field usage.

#### Mismatch rules (initial)
- `API-REQ-001`: required backend field missing in frontend request.
- `API-REQ-002`: field naming mismatch (`snake_case` vs `camelCase`) with no mapper.
- `API-TYPE-001`: field type mismatch (e.g., number vs string).
- `API-RES-001`: frontend reads response field not defined in backend contract.
- `API-RES-002`: backend returns required field ignored where mandatory UI flow expects it.

#### Output
- Per endpoint mismatch report with file anchors.
- Suggested mapper or DTO fix where possible.

#### Acceptance criteria
- Validator supports OpenAPI-first mode.
- Reports include endpoint + frontend file references.
- Critical mismatches can be configured to block `pg prod`.

---

### 4) Phased delivery after enforcement milestones

#### Phase 1 (local deterministic)
- Environment Doctor
- AI Trust Score (local + existing policy outputs)
- Commit Gate

#### Phase 2 (core product depth)
- Codebase Tour
- API Contract Validator (OpenAPI-first)

#### Phase 3 (enterprise hardening)
- Contract validator blocking mode in `pg prod`
- Team dashboards and trends

---

## 2026-02-27 Architecture Alignment (External Specs -> Product Placement)

### Decision Summary
- We are building a VS Code extension + policy platform where users can bring their own coding agent (Copilot/Codex/Claude/Ollama).
- Keep deterministic developer checks local-first.
- Keep sensitive scoring logic, weights, private deny lists, and compliance mapping server-private.
- Use MCP cloud scoring as metadata-only evidence exchange (no full source upload requirement).
- Treat managed observability hosting as optional enterprise service, not mandatory for core extension adoption.

### Placement Matrix

| Source Document | Keep | Primary Placement | Notes |
|---|---|---|---|
| `extension_architecture_complete.md` | Yes (with constraints) | Product architecture + onboarding docs | Correct on "we provide tools, user brings agent". Keep; remove assumptions that every agent auto-discovers extension tools without explicit integration checks. |
| `local_first_agent_architecture.md` | Yes (staged) | Local-first strategy + enterprise deployment tracks | Keep 3 deployment modes (local/hybrid/managed). Make relay/managed mode opt-in enterprise. |
| `our_stack_vs_datadog_guide.md` | Partial | Competitive positioning + optional observability integrations | Keep feature mapping and cost framing. Do not promise parity as "already done" unless implemented and validated in this repo/runtime. |
| `defence_in_depth_toolchain.md` | Yes (adapted) | Server-private policy packs + CI/CD templates | Keep layered controls model; encode as rule IDs and policy profiles. Avoid shipping full private rule internals client-side. |
| `wallet_system_data_placement_guide.md` | Yes (enterprise profile) | Cloud architecture policy checks (`regulated` profile) | Keep data classification (financial/PII vs operational vs static). Use as policy evidence checklist, not hardcoded provider-only lock. |
| `secure_cloud_architecture_spec.md` | Yes (core for cloud scoring) | MCP cloud scoring rule families + enterprise readiness gates | Keep as source for control families and blockers/warnings. Convert to compact rule-ID bundles and evidence requirements. |

### Exact Implementation Mapping (Now)

| Layer | What goes here | From which source docs |
|---|---|---|
| Local extension + local scripts | Fast developer checks, command diagnostics, trust/dead-code/env/commit gates, simple runbooks, no private rulebook internals | `extension_architecture_complete.md`, `local_first_agent_architecture.md` |
| Server-private policy engine | Canonical rule datasets, scoring weights, compliance mappings, strict blocker/warning logic, private thresholds | `defence_in_depth_toolchain.md`, `secure_cloud_architecture_spec.md`, `wallet_system_data_placement_guide.md` |
| MCP cloud score bridge | Metadata-only scanner summary + architecture evidence intake, deterministic score/grade/findings output | `secure_cloud_architecture_spec.md`, `wallet_system_data_placement_guide.md` |
| Optional PG-managed observability | Self-hosted adapters for OTLP/Sentry/SigNoz and relay model for teams that do not want BYOC | `our_stack_vs_datadog_guide.md`, `local_first_agent_architecture.md` |
| Optional customer-hosted enterprise mode | Same adapters but customer endpoint ownership (`customer-hosted`/`hybrid`) with zero vendor lock | `local_first_agent_architecture.md`, `our_stack_vs_datadog_guide.md` |

### What We Build Ourselves vs What We Integrate

| Area | Build ourselves | Integrate (SDK/protocol only) |
|---|---|---|
| Policy enforcement + score logic | Yes | No |
| Command UX + runbooks + PG CLI | Yes | No |
| Runtime telemetry protocol export (OTLP) | Adapter/config logic | OpenTelemetry protocol + SDK |
| Error tracking ingestion | Adapter/config logic | Sentry SDK/protocol (self-hosted or customer-hosted endpoint) |
| Metrics/log backend | Health/readiness controls + policy checks | SigNoz/OTel collectors (self-hosted or customer-hosted) |
| AI trace observability | Health/readiness controls + policy checks | Langfuse/OpenLLMetry (optional, enterprise profile) |

### Execution Order (No Vendor Lock, Low Cost First)

1. Keep local-first default strict and stable:
   - `.\pg.ps1 obs-check`
   - `.\pg.ps1 db-check`
   - `.\pg.ps1 cloud-score -WorkloadSensitivity regulated`
2. Extend server-private observability policy packs:
   - required evidence per adapter (`endpoint`, `token`, `hosted_by`, readiness).
   - profile-aware requirements (`pg-hosted`, `customer-hosted`, `hybrid`).
3. Add managed adapter presets (PG-hosted) for easier onboarding:
   - OTLP first, then Sentry, then SigNoz health/readiness presets.
4. Add enterprise BYOC/on-prem presets:
   - same checks, but ownership set to customer and strict boundary controls.
5. Keep Datadog-style parity as roadmap benchmark only:
   - never mark parity "done" until each capability is implemented and validated by command evidence in this repo.

### Acceptance Criteria for This Alignment

- Every control is placed in exactly one primary runtime layer (local, server-private, MCP, or managed optional).
- Private scoring internals are never exposed in extension-facing docs/help/outputs.
- MCP cloud score remains metadata/evidence based and does not require raw source upload by default.
- Observability can run both as PG-hosted default and customer-hosted enterprise without changing policy semantics.
- Help center and `pg help` keep short aliases for user memory (`obs-check`, `db-check`, `db-fix`, `cloud-score`).

### Boundary Rules (Must Enforce)
- Local extension/agent side:
  - Run fast deterministic checks, local diagnostics, trust UI, dead-code/env/commit quality flows.
  - Show outcomes and remediation hints.
  - Never contain full private scoring rulebooks/weights for paid policy packs.
- Server-private policy side:
  - Own canonical policy datasets, thresholds, pricing-tier overlays, and compliance mappings.
  - Return opaque rule IDs + actionable hints, not full proprietary internals.
- MCP cloud scoring side:
  - Accept scanner metadata + explicit control evidence.
  - Score and return `status/score/grade/findings`.
  - Support sensitivity profiles (`standard`, `regulated`) with stricter regulated blockers.
- Enterprise managed-service side:
  - Optional hosted observability/relay/admin features.
  - Must preserve customer data ownership and explicit retention/deletion controls.

### Out-of-Scope for Core Local MVP (Do Not Block Current Delivery)
- Full managed observability stack operations (SigNoz/Sentry/Langfuse hosting lifecycle).
- Air-gapped enterprise packager and offline licensing runtime.
- Full Datadog feature parity claims as release criteria for core extension.

### Milestone Alignment Update
- Keep Milestone 13E focused on MCP cloud scoring bridge maturity (policy profile + evidence model).
- Milestone 13H baseline delivered:
  - authenticated observability readiness route (`/account/policy/observability/check`)
  - local command bridge (`.\pg.ps1 observability-check`)
  - adapter scaffold (`none|otlp|sentry|signoz`) with profile ownership checks (`pg-hosted`, `customer-hosted`, `hybrid`)
- Add an architecture-governance checkpoint before expanding enterprise hosting features:
  - define what is local-open vs server-private vs MCP metadata.
  - define enterprise-only controls and retention requirements.
  - define acceptance tests for each boundary.
