# PG LIFE — Autonomous AI Operations Agent

## What This Is

PG Life is an AI agent that runs locally on the developer's machine (or a dedicated server) and acts as a **24/7 junior DevOps engineer**. It monitors production systems, reads logs, detects issues, runs smoke tests, creates fixes in isolation, tests them, and either auto-patches or sends the fix to a senior developer for approval — all without human intervention.

The user types `pglife start` and walks away. The agent takes over.

---

## The Core Loop

```
Every N minutes (configurable: 1min, 5min, 30min):

┌─────────────────────────────────────────────────────────┐
│ 1. HEARTBEAT CHECK                                       │
│    Is the application alive?                             │
│    → HTTP health check on configured endpoints           │
│    → Check status codes (200 OK? 503? Timeout?)         │
│    → Measure response time (within threshold?)           │
│    → If DOWN → escalate immediately (skip to step 5)     │
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 2. LOG INGESTION                                         │
│    What happened since last check?                       │
│    → Pull new logs from configured source                │
│    → Parse structured logs (JSON) for errors/warnings    │
│    → Store in local rotating memory bank (7-day window)  │
│    → Detect patterns: error spikes, new error types,     │
│      repeated failures, slow queries, OOM events         │
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 3. SERVICE HEALTH CHECK                                  │
│    Are all services/containers healthy?                   │
│    → Docker: check container status, restart counts      │
│    → Kubernetes: pod status, crash loops, pending pods   │
│    → Eureka/Consul: registered services, health status   │
│    → Database: connection pool, active queries           │
│    → Redis: memory usage, connection count               │
│    → Queue: dead letter queue depth, consumer lag        │
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 4. SMOKE TEST (Playwright)                               │
│    Is the user experience working?                       │
│    → Navigate to key pages                               │
│    → Click critical buttons (login, checkout, submit)    │
│    → Check for JS console errors                         │
│    → Verify API responses are correct                    │
│    → Screenshot on failure for evidence                  │
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 5. DIAGNOSIS & TRIAGE                                    │
│    What's wrong and how severe is it?                    │
│    → Classify: CRITICAL / WARNING / INFO                 │
│    → Correlate: which service + which error + since when │
│    → Root cause analysis from log patterns               │
│    → Decision: can the agent fix this autonomously?      │
│                                                          │
│    AUTO-FIXABLE (agent proceeds):                        │
│    • OOM restart needed                                  │
│    • Known error pattern with documented fix             │
│    • Dependency timeout (retry/circuit breaker issue)    │
│    • SSL cert expiring (auto-renew)                      │
│    • Disk space (log rotation)                           │
│    • Container crash loop (restart with backoff)         │
│                                                          │
│    NEEDS HUMAN (agent creates fix, waits for approval):  │
│    • Code bug causing 500 errors                         │
│    • Database schema issue                               │
│    • Security vulnerability detected                     │
│    • Performance degradation (requires investigation)    │
│    • Unknown error pattern (never seen before)           │
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 6. FIX IN ISOLATION                                      │
│    Agent creates the patch WITHOUT touching production   │
│    → Clone the repo (or use local working copy)          │
│    → Create a fix branch: fix/pglife-{timestamp}-{desc}  │
│    → Apply the fix following coding standards            │
│    → Run the production checklist (ProdCheck)            │
│    → Run unit tests + integration tests                  │
│    → Run Playwright smoke test against local dev server  │
│    → If all pass → proceed to step 7                     │
│    → If tests fail → log failure, notify, stop           │
└──────────────────┬──────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────┐
│ 7. REPORT & DEPLOY                                       │
│    → Generate detailed report:                           │
│      - What was detected                                 │
│      - Root cause analysis                               │
│      - What was fixed                                    │
│      - Test results (all passing)                        │
│      - Screenshots / log excerpts                        │
│      - Diff of changes                                   │
│    → Send report to Slack (secure channel)               │
│    → Create Pull Request on GitHub/GitLab                │
│    → IF auto-deploy approved: merge and deploy           │
│    → IF manual approval: wait for senior dev review      │
└─────────────────────────────────────────────────────────┘
```

---

## Security Model — The Sandbox

PG Life operates in a **strict sandbox**. It is NOT a general-purpose agent.

```
WHAT PG LIFE CAN ACCESS:
═══════════════════════
✅ Configured health check URLs (your app endpoints only)
✅ Configured log sources (your log files, your log API)
✅ Configured service registry (your Docker/K8s/Eureka only)
✅ Your codebase (local git repo)
✅ Official documentation sites (from the dependency verification list)
✅ npm/PyPI/pub.dev registries (for dependency checks)
✅ Your Slack workspace (one designated channel only)
✅ Your GitHub/GitLab (for PRs only)

WHAT PG LIFE CANNOT ACCESS:
════════════════════════════
❌ Any URL not in the allowlist
❌ The open internet (no browsing, no prompt injection risk)
❌ Other people's servers or APIs
❌ Production database directly (reads logs only, never writes)
❌ Secrets or credentials beyond what's needed for monitoring
❌ Email, social media, or any other communication channel
❌ Other projects or repos on the machine
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  DEVELOPER'S MACHINE (or dedicated server)   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    PG LIFE AGENT                      │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │  Scheduler   │  │  Log Ingestor │  │  Smoke     │  │   │
│  │  │  (cron loop) │  │  & Memory     │  │  Tester    │  │   │
│  │  │              │  │  Bank         │  │ (Playwright)│  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │   │
│  │         │                  │                 │         │   │
│  │         ▼                  ▼                 ▼         │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │              DIAGNOSIS ENGINE                    │  │   │
│  │  │  (Pattern matching, severity classification,     │  │   │
│  │  │   root cause analysis, fix decision)             │  │   │
│  │  └──────────────────┬──────────────────────────────┘  │   │
│  │                     │                                  │   │
│  │         ┌───────────┼───────────┐                     │   │
│  │         ▼           ▼           ▼                     │   │
│  │  ┌───────────┐ ┌─────────┐ ┌──────────┐             │   │
│  │  │ Auto-Fix   │ │ Report  │ │ ProdCheck│             │   │
│  │  │ Engine     │ │ Generator│ │ Scanner  │             │   │
│  │  │ (git,patch)│ │ (md,json)│ │ (our CLI)│             │   │
│  │  └─────┬─────┘ └────┬────┘ └────┬─────┘             │   │
│  │        │             │           │                    │   │
│  └────────┼─────────────┼───────────┼────────────────────┘   │
│           │             │           │                         │
│           ▼             ▼           │                         │
│    ┌────────────┐ ┌──────────┐     │                         │
│    │ Git / PR    │ │  Slack   │     │                         │
│    │ (GitHub/    │ │ (notify) │     │                         │
│    │  GitLab)    │ │          │     │                         │
│    └────────────┘ └──────────┘     │                         │
│                                     │                         │
│  ┌──────────────────────────────────┴───────────────────┐   │
│  │              LOCAL MEMORY BANK                        │   │
│  │  /home/user/.pglife/                                  │   │
│  │  ├── logs/           ← Rotating log store (7 days)   │   │
│  │  ├── reports/        ← Generated incident reports     │   │
│  │  ├── screenshots/    ← Playwright failure captures    │   │
│  │  ├── patches/        ← Fix branches and diffs         │   │
│  │  ├── config.yaml     ← All configuration              │   │
│  │  └── state.json      ← Last check state, known issues │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

EXTERNAL CONNECTIONS (strict allowlist only):
─────────────────────────────────────────────
→ Your app: https://your-app.com/health (health checks)
→ Your logs: Configured source (file, API, Slack webhook)
→ Your infra: Docker socket / K8s API / service registry
→ Slack: One channel only (outbound notifications)
→ GitHub/GitLab: PR creation only
→ Docs: npm registry, official framework docs (read-only)
```

---

## The Local Memory Bank

Logs need to be stored locally, rotated, and never bloat the disk.

```
/home/user/.pglife/
├── config.yaml                   ← User configuration
├── state.json                    ← Current state (last check, known issues)
│
├── logs/                         ← Rotating error log store
│   ├── 2026-02-23.jsonl         ← Today's logs (JSON Lines format)
│   ├── 2026-02-22.jsonl         ← Yesterday
│   ├── 2026-02-21.jsonl         ← ...
│   └── (auto-deleted after 7 days)
│
├── reports/                      ← Incident reports
│   ├── incident-2026-02-23-1422-oom-user-service.md
│   └── incident-2026-02-23-0830-500-checkout-api.md
│
├── screenshots/                  ← Playwright failure evidence
│   ├── fail-checkout-2026-02-23-1422.png
│   └── (auto-deleted after 7 days)
│
└── patches/                      ← Fix branches
    ├── fix-pglife-20260223-oom-restart/
    └── fix-pglife-20260223-null-pointer-checkout/
```

### Log Flow

```
Option A: LOG FILE TAILING (simplest — for single server)
═════════════════════════════════════════════════════════
Your app writes logs to /var/log/app/app.log
PG Life tails the file, parses new lines, stores in memory bank

Option B: LOG API POLLING (for cloud / managed services)
═══════════════════════════════════════════════════════════
PG Life calls your log API every N minutes:
  → CloudWatch Logs API (AWS)
  → Cloud Logging API (GCP)
  → Grafana Loki API
  → Datadog Logs API
  → Custom log endpoint you expose

Option C: WEBHOOK RECEIVER (for real-time)
═══════════════════════════════════════════
PG Life runs a tiny local HTTP server (localhost:9876)
Your logging system sends error logs to this webhook
PG Life receives, stores, and processes immediately

Option D: SLACK LOG FORWARDING (cheapest — for small teams)
════════════════════════════════════════════════════════════
Your app sends error logs to a Slack channel (#error-logs)
PG Life reads from that Slack channel via API
PG Life stores locally → deletes from Slack after processing
This way Slack is the transport, local disk is the store

RECOMMENDED for your pricing:
  Students ($10/yr): Option A (file tailing) or D (Slack)
  Enterprise ($99/mo): Option B (log API) or C (webhook)
```

---

## Configuration File

```yaml
# ~/.pglife/config.yaml

# === Identity ===
project_name: "my-saas-app"
environment: "production"

# === Scheduling ===
check_interval: 5m              # How often to run the full loop
heartbeat_interval: 1m          # How often to check if app is alive
smoke_test_interval: 30m        # How often to run Playwright tests

# === Health Check Endpoints ===
health_checks:
  - url: https://my-app.com/health
    expected_status: 200
    timeout: 10s
    name: "Main API"
  - url: https://my-app.com/api/readiness
    expected_status: 200
    timeout: 5s
    name: "Readiness Probe"

# === Smoke Test Pages ===
smoke_tests:
  base_url: https://my-app.com
  tests:
    - path: /
      name: "Homepage"
      check_elements: ["nav", "footer", "h1"]
    - path: /login
      name: "Login Page"
      fill_form:
        email: test@example.com
        password: "${SMOKE_TEST_PASSWORD}"
      submit_button: "Sign In"
      expect_redirect: /dashboard
    - path: /dashboard
      name: "Dashboard"
      requires_auth: true
    - path: /checkout
      name: "Checkout Flow"
      critical: true

# === Log Sources ===
log_source:
  type: file                    # file | api | webhook | slack
  path: /var/log/app/app.log   # for type: file
  # api_url: https://...       # for type: api
  # slack_channel: "#errors"   # for type: slack
  format: json                  # json | text
  error_patterns:               # What to look for
    - level: error
    - level: fatal
    - message_contains: "ECONNREFUSED"
    - message_contains: "OOMKilled"
    - message_contains: "TimeoutError"
    - message_contains: "DEADLINE_EXCEEDED"

# === Infrastructure ===
infrastructure:
  type: docker                  # docker | kubernetes | eureka | consul | none
  # docker_socket: /var/run/docker.sock
  # k8s_context: production
  # eureka_url: http://localhost:8761
  containers_to_watch:
    - api-server
    - worker
    - redis
    - postgres

# === Code Repository ===
repository:
  path: /home/user/my-app
  main_branch: main
  auto_create_pr: true
  auto_merge: false              # true = agent can deploy. false = needs approval

# === Coding Standards ===
coding_standards:
  enforce_prodcheck: true        # Run ProdCheck before any PR
  max_file_loc: 500
  patterns:                      # Enforce specific code patterns
    controller: "src/templates/controller.template.ts"
    service: "src/templates/service.template.ts"
    repository: "src/templates/repository.template.ts"
    dto: "src/templates/dto.template.ts"

# === Notifications ===
notifications:
  slack:
    webhook_url: "${SLACK_WEBHOOK_URL}"
    channel: "#pglife-alerts"
    mention_on_critical: "@senior-dev"
  # email:
  #   to: admin@company.com

# === URL Allowlist (security sandbox) ===
url_allowlist:
  - my-app.com
  - api.my-app.com
  - github.com/my-org/my-app
  - registry.npmjs.org
  - pypi.org
  - docs.nestjs.com
  - nextjs.org/docs
  # Add official doc URLs as needed

# === Memory Bank ===
memory_bank:
  log_retention_days: 7
  screenshot_retention_days: 7
  max_disk_usage: 500MB

# === Auto-Fix Rules ===
auto_fix:
  enabled: true
  allowed_actions:
    - container_restart          # Restart crashed containers
    - log_rotation               # Clear old logs when disk is full
    - cache_clear                # Clear Redis/app cache
    - dependency_update_patch    # Update patch versions (1.2.3 → 1.2.4)
  denied_actions:
    - database_migration         # Never auto-migrate
    - dependency_update_major    # Never auto-update major versions
    - infrastructure_change      # Never change infra config
    - secret_rotation            # Never touch secrets automatically
```

---

## The Coding Standards Enforcement

You mentioned the AI creates code that's hard to maintain. PG Life enforces patterns.

```
# In the config, you define template files:
coding_standards:
  patterns:
    controller: "src/templates/controller.template.ts"

# The template file shows EXACTLY how code must be structured:
```

### Example: Controller Template (what the agent MUST follow)

```typescript
// FILE: src/templates/controller.template.ts
// This is the EXACT pattern all controllers must follow.
// PG Life rejects any PR where a controller deviates from this structure.

import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
// [SERVICE_IMPORT] — service for this controller
// [DTO_IMPORTS] — request/response DTOs

@ApiTags('[RESOURCE_NAME]')
@Controller('api/v1/[resource-name]')
@UseGuards(RolesGuard)
export class [ResourceName]Controller {
  // 1. Constructor with dependency injection ONLY
  constructor(private readonly [resourceName]Service: [ResourceName]Service) {}

  // 2. GET list (with pagination)
  @Get()
  @Roles('user', 'admin')
  @ApiOperation({ summary: 'List [resources]' })
  @ApiResponse({ status: 200, type: [ResponseDto] })
  async findAll(@Query() query: PaginationQueryDto) {
    return this.[resourceName]Service.findAll(query);
    // NO business logic here. Controller only calls service.
  }

  // 3. GET by ID
  @Get(':id')
  @Roles('user', 'admin')
  async findOne(@Param('id') id: string) {
    return this.[resourceName]Service.findOne(id);
  }

  // 4. POST create
  @Post()
  @Roles('admin')
  async create(@Body() dto: Create[ResourceName]Dto) {
    return this.[resourceName]Service.create(dto);
  }

  // 5. PUT update
  @Put(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: Update[ResourceName]Dto) {
    return this.[resourceName]Service.update(id, dto);
  }

  // 6. DELETE
  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.[resourceName]Service.remove(id);
  }
}

// RULES:
// - Controller has NO business logic (max 1 line per method: service call)
// - All endpoints have @Roles decorator
// - All endpoints have @ApiOperation and @ApiResponse
// - All inputs validated via DTOs with class-validator
// - No direct database access
// - No try/catch (handled by global ExceptionFilter)
// - File must not exceed 100 LOC
```

---

## How PG Life Integrates with Everything We Built

```
┌──────────────────────────────────────────────────────┐
│                 YOUR PRODUCT SUITE                     │
│                                                        │
│  ┌──────────────────┐  ┌────────────────────────┐    │
│  │ Skills Documents  │  │ Production Checklists   │    │
│  │ (18 files)        │  │ (17 files)              │    │
│  │ "How to build"    │  │ "What to check"         │    │
│  └────────┬─────────┘  └──────────┬─────────────┘    │
│           │                        │                   │
│           ▼                        ▼                   │
│  ┌──────────────────┐  ┌────────────────────────┐    │
│  │ Dependency        │  │ Coding Standard         │    │
│  │ Verification      │  │ Templates               │    │
│  │ "What to install" │  │ "How to structure"      │    │
│  └────────┬─────────┘  └──────────┬─────────────┘    │
│           │                        │                   │
│           ▼                        ▼                   │
│  ┌──────────────────────────────────────────────┐     │
│  │           PRODCHECK CLI / MCP                  │     │
│  │  "Scan code before deployment"                 │     │
│  └────────────────────┬─────────────────────────┘     │
│                       │                                │
│                       ▼                                │
│  ┌──────────────────────────────────────────────┐     │
│  │              PG LIFE                           │     │
│  │  "Monitor, diagnose, fix AFTER deployment"    │     │
│  │                                                │     │
│  │  Uses ALL of the above:                       │     │
│  │  • Skills docs → knows correct patterns        │     │
│  │  • Checklists → validates any fix it creates   │     │
│  │  • Dep verification → safe dependency updates  │     │
│  │  • Coding templates → enforces structure        │     │
│  │  • ProdCheck → scans fix before PR             │     │
│  └──────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘

LIFECYCLE:
  BUILD  → Skills + Dep Verification + Templates guide development
  CHECK  → ProdCheck scans code before deployment
  DEPLOY → Push to production
  MONITOR → PG Life watches 24/7
  FIX    → PG Life creates patch using Skills + Templates
  VERIFY → PG Life runs ProdCheck on the fix
  REPORT → PG Life notifies via Slack, creates PR
  REPEAT → Loop forever
```

---

## Enterprise Dashboard (Optional Web UI)

For enterprise customers, a simple dashboard where they configure PG Life:

```
┌─────────────────────────────────────────────────────────┐
│  PG LIFE DASHBOARD                       [Settings] [?] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  STATUS: 🟢 ALL SYSTEMS HEALTHY       Last: 2 min ago  │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ Uptime       │ │ Errors (24h)│ │ Fixes Applied   │   │
│  │ 99.97%       │ │ 3 warnings  │ │ 2 auto-patched  │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
│                                                          │
│  RECENT ACTIVITY:                                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 14:22  🟡 Memory spike on user-service (78% → 92%)│  │
│  │ 14:23  🔧 Auto-restarted user-service container   │  │
│  │ 14:24  🟢 user-service healthy (memory: 45%)      │  │
│  │ 08:30  🔴 500 error on /api/checkout              │  │
│  │ 08:31  🔍 Diagnosis: null pointer in CartService   │  │
│  │ 08:35  🔧 Fix created: fix/pglife-null-cart        │  │
│  │ 08:36  ✅ All tests passing. PR created.           │  │
│  │ 08:40  📩 Notified @john via Slack                 │  │
│  │ 09:15  ✅ PR merged by @john. Deployed.            │  │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  CONFIGURATION:                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Health Check URLs     [Edit]                      │   │
│  │ Log Source            Docker logs (file tail)     │   │
│  │ Slack Channel         #pglife-alerts              │   │
│  │ Auto-Fix              Enabled (container restart)  │   │
│  │ Auto-Merge PRs        Disabled (manual approval)   │   │
│  │ Check Interval        5 minutes                    │   │
│  │ Smoke Test Interval   30 minutes                   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Pricing Integration

```
FREE (Student — $10/year with ProdCheck)
├── Health check monitoring (heartbeat only)
├── Basic log tailing (file-based)
├── Slack notifications for downtime
├── Manual check only (no auto-loop)
└── "pglife check" runs once, reports results

PRO (Solo founder — $29/month)
├── Everything in Free, PLUS:
├── Automated monitoring loop (configurable interval)
├── Playwright smoke testing
├── Error log analysis with pattern detection
├── Auto-fix for container restarts and cache clears
├── PR creation for code fixes
└── Local memory bank with 7-day rotation

ENTERPRISE ($99-299/month per team)
├── Everything in Pro, PLUS:
├── Dashboard web UI
├── Multiple environment monitoring (staging + prod)
├── Custom coding standard templates
├── Auto-merge capability (with approval workflows)
├── Docker/Kubernetes/Eureka integration
├── Webhook log ingestion (real-time)
├── Custom auto-fix rules
├── Team Slack notifications with role tagging
├── Encrypted offline mode (no data leaves network)
└── Audit trail of all agent actions
```

---

## Build Order

### Phase 1: MVP (Weeks 1-3)
```
pglife check              ← One-shot: health check + log scan + report
pglife start              ← Starts the monitoring loop
pglife stop               ← Stops the loop
pglife status             ← Shows current state
pglife report             ← Generates a report of recent activity
```

Build:
- [ ] Health check module (HTTP checks with configurable endpoints)
- [ ] Log file tailer (read new lines, parse JSON, detect errors)
- [ ] Local memory bank (JSONL files with 7-day rotation)
- [ ] Slack notification (webhook-based, one channel)
- [ ] Config file parser (YAML)
- [ ] Scheduler (setInterval-based loop)

### Phase 2: Smoke Testing + Diagnosis (Weeks 4-6)
- [ ] Playwright integration (navigate pages, click buttons, check errors)
- [ ] Screenshot on failure
- [ ] Error pattern matching (classify known vs unknown errors)
- [ ] Severity classification (CRITICAL / WARNING / INFO)
- [ ] Root cause correlation (which service + which error + when)

### Phase 3: Auto-Fix Engine (Weeks 7-10)
- [ ] Git integration (create branch, commit, create PR)
- [ ] Container restart (Docker API)
- [ ] Fix engine (apply patches following coding templates)
- [ ] ProdCheck integration (scan fix before PR)
- [ ] Test runner (run project's test suite on the fix)
- [ ] Report generator (markdown incident reports)

### Phase 4: Enterprise (Weeks 11-14)
- [ ] Dashboard web UI (simple React app, runs locally)
- [ ] Kubernetes integration
- [ ] Webhook log ingestion
- [ ] Multiple environment support
- [ ] Custom auto-fix rules
- [ ] Audit trail

---

## Technical Stack for PG Life

| Component | Technology | Why |
|---|---|---|
| Core agent | TypeScript (Node.js) | Same as ProdCheck, shared code |
| Scheduler | node-cron | Simple, reliable cron scheduling |
| HTTP checks | Native fetch | No dependency needed |
| Log parsing | Custom (readline + JSON.parse) | Fast, no overhead |
| Playwright | @playwright/test | Free, reliable browser automation |
| Git | simple-git (npm) | Git operations from Node.js |
| Slack | Incoming Webhooks | Simplest Slack integration |
| Docker | dockerode (npm) | Docker API client for Node.js |
| Config | yaml (npm) | Parse YAML config |
| Storage | File system (JSONL) | No database needed |
| Dashboard | Next.js (optional) | Only for enterprise tier |
| MCP wrapper | @modelcontextprotocol/sdk | For AI IDE integration |
| AI brain | Claude API (for diagnosis) | Optional: for intelligent root cause analysis |

**Total dependencies:** ~8 packages. Intentionally minimal.
**Estimated binary size:** ~50MB (with Playwright bundled)
**RAM usage:** ~100MB idle, ~500MB during smoke tests

---

## Key Design Decisions

### 1. Everything is local
No cloud dependency. The machine running PG Life is the machine doing everything. Enterprise data never leaves their network. The AI diagnosis can optionally call Claude API for intelligent analysis, but it works offline with pattern-matching fallback.

### 2. Logs flow in, never out
Logs come TO PG Life (pull or push). PG Life never sends log contents anywhere. Slack notifications contain summaries, never raw logs. PRs contain code diffs, never log data.

### 3. The agent follows YOUR patterns
The coding templates are YOUR rules. The agent doesn't invent architecture — it follows the controller template, the service template, the DTO template you define. If it deviates, ProdCheck catches it before the PR is created.

### 4. Humans stay in control
Auto-fix is off by default. Even when enabled, it's limited to safe operations (restart, cache clear). Code fixes always go through PR. The senior dev always has final say. The agent is an assistant, not a replacement.

### 5. Cheap to run
File-based log storage (no database needed). Playwright is free. Slack webhooks are free. Git is free. The only cost is the machine's electricity and optionally the Claude API for intelligent diagnosis (~$0.01 per analysis).
