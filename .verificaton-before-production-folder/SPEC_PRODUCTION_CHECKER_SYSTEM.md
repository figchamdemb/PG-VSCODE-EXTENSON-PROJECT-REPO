# Production-Readiness Verification System — Architecture & Spec Plan

## Executive Summary

This document outlines the architecture for a **production-readiness verification system** that scans codebases against your proprietary skills and checklists, runs automated checks, and generates pass/fail reports — all while **protecting your intellectual property** (the checklists and rules engine) from exposure to end users.

---

## 1. THE CORE PROBLEM TO SOLVE

You have two valuable assets:
1. **The Checklists & Rules** (your IP) — the knowledge of WHAT to check
2. **The Verification Engine** — the logic of HOW to check it

You want:
- Students/developers to USE the system to verify their code is production-ready
- The system to scan code, check every button works, validate TypeScript/Zod/security/performance
- Your IP (the actual checklist rules) to remain **hidden from the end user**
- Both local (offline) and cloud deployment options
- Cost-effective to build and maintain

---

## 2. ARCHITECTURE OPTIONS COMPARED

### Option A: Fully Cloud (API-Based)
```
User's IDE/CLI → calls your API → API runs checks → returns pass/fail report
```
- ✅ IP fully protected (rules never leave your server)
- ✅ Easy to update rules centrally
- ❌ Requires internet. Enterprise customers may refuse external API calls
- ❌ User must upload code or grant repo access (trust issue)
- ❌ Ongoing server costs
- **Best for:** SaaS product, student platform

### Option B: Fully Local (MCP Server or CLI Tool)
```
User installs local tool → tool contains rules (encrypted/obfuscated) → runs locally
```
- ✅ No internet required. Code never leaves the machine
- ✅ Enterprise-friendly (no external data flow)
- ❌ IP is on the user's machine (must obfuscate/encrypt)
- ❌ Harder to update rules
- **Best for:** Enterprise customers, privacy-sensitive users

### Option C: Hybrid (RECOMMENDED)
```
User installs lightweight local agent → agent scans code locally →
sends ONLY metadata/hashes to your API → API returns enriched results
```
- ✅ Code never leaves the machine (enterprise-friendly)
- ✅ Core rule logic stays on your server (IP protected)
- ✅ Local agent is thin and replaceable
- ✅ Works offline in degraded mode, full power online
- **Best for:** Both students and enterprise

---

## 3. RECOMMENDED ARCHITECTURE: HYBRID MODEL

### 3.1 System Components

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S MACHINE                        │
│                                                          │
│  ┌──────────────┐    ┌─────────────────────────────┐    │
│  │   IDE/Editor  │───→│  Local Agent (MCP Server)    │    │
│  │  (VS Code,    │    │                              │    │
│  │   Cursor,     │    │  • Static code scanner       │    │
│  │   Claude)     │    │  • AST parser (TypeScript,   │    │
│  │               │    │    Python, Kotlin, Dart)      │    │
│  └──────────────┘    │  • UI test runner (Playwright)│    │
│                       │  • Config file checker        │    │
│                       │  • Sends metadata only to API │    │
│                       └──────────┬──────────────────┘    │
│                                  │                        │
└──────────────────────────────────┼────────────────────────┘
                                   │ HTTPS (metadata only,
                                   │ no source code sent)
                                   ▼
┌──────────────────────────────────────────────────────────┐
│                    YOUR CLOUD (API)                        │
│                                                            │
│  ┌─────────────────────────────────────────────────┐      │
│  │              Rules Engine (YOUR IP)               │      │
│  │                                                    │      │
│  │  • All 17 checklists stored here                  │      │
│  │  • Scoring/weighting logic                        │      │
│  │  • Technology detection rules                     │      │
│  │  • Severity classification                        │      │
│  │  • Report generation templates                    │      │
│  │  • Rule updates pushed to clients                 │      │
│  └─────────────────────────────────────────────────┘      │
│                                                            │
│  ┌─────────────────┐  ┌──────────────────────────┐       │
│  │  License Server  │  │  Analytics & Dashboards   │       │
│  │  (user auth,     │  │  (aggregate scan data,    │       │
│  │   tier limits)   │  │   common failures)        │       │
│  └─────────────────┘  └──────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

### 3.2 What Stays Local vs Cloud

| Component | Location | Reason |
|-----------|----------|--------|
| Code scanning (AST parsing) | LOCAL | Code never leaves machine |
| UI testing (Playwright/Detox) | LOCAL | Needs running app |
| Config file checks | LOCAL | Reads local files |
| Dependency audit | LOCAL | Reads package.json/lock |
| **Checklist rules & weights** | **CLOUD** | **Your IP — protected** |
| **Scoring logic** | **CLOUD** | **Your IP — protected** |
| **Report templates** | **CLOUD** | **Your IP — protected** |
| License validation | CLOUD | Subscription management |
| Rule updates | CLOUD → LOCAL | Push new rules to agents |

### 3.3 Data Flow (What Gets Sent to Your API)

The local agent sends ONLY **metadata** — never source code:

```json
{
  "scan_id": "uuid",
  "project_type": "nextjs",
  "tech_stack": ["nextjs", "typescript", "prisma", "postgresql", "redis"],
  "findings": [
    {
      "rule_id": "SEC-001",
      "category": "security",
      "check": "jwt_signing_algorithm",
      "result": "FAIL",
      "detail": "HS256 detected in auth config",
      "file": "src/lib/auth.ts",
      "line": 42
    },
    {
      "rule_id": "PERF-003",
      "category": "performance",
      "check": "n_plus_one_query",
      "result": "PASS",
      "detail": "All Prisma queries use include/select"
    },
    {
      "rule_id": "UI-001",
      "category": "ui_testing",
      "check": "button_clickable",
      "result": "PASS",
      "detail": "47/47 interactive elements verified"
    }
  ],
  "stats": {
    "files_scanned": 234,
    "total_loc": 18420,
    "max_file_loc": 487,
    "test_coverage": 82.3
  }
}
```

The API returns:
```json
{
  "score": 78,
  "grade": "B+",
  "production_ready": false,
  "blockers": 3,
  "warnings": 7,
  "report": [
    {
      "rule_id": "SEC-001",
      "severity": "BLOCKER",
      "title": "JWT uses weak signing algorithm",
      "recommendation": "Switch to RS256 for production inter-service auth",
      "category": "Security",
      "priority": 1
    }
  ],
  "summary": "3 blockers must be resolved before production deployment"
}
```

**Key insight:** The user sees WHAT failed and HOW to fix it, but never sees the complete checklist, the scoring weights, or the full rule set. They only see the rules that are relevant to their code.

---

## 4. THE LOCAL AGENT (MCP SERVER)

### 4.1 Why MCP (Model Context Protocol)

MCP is the right choice because:
- It integrates directly into Claude, Cursor, VS Code, and other AI-powered IDEs
- The user can say "check my code for production readiness" and the MCP server handles it
- It runs locally — no code leaves the machine
- It's the emerging standard for AI tool integration

### 4.2 MCP Server Structure

```
your-prod-checker/
├── package.json
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── tools/
│   │   ├── scan-project.ts         # Main orchestrator tool
│   │   ├── scan-security.ts        # Security-specific checks
│   │   ├── scan-performance.ts     # Performance checks
│   │   ├── scan-database.ts        # DB pattern checks
│   │   ├── scan-ui.ts              # UI/accessibility testing
│   │   └── scan-config.ts          # Config file validation
│   ├── parsers/
│   │   ├── typescript-parser.ts    # AST parsing for TS/JS
│   │   ├── python-parser.ts        # AST parsing for Python
│   │   ├── kotlin-parser.ts        # Kotlin static analysis
│   │   ├── dart-parser.ts          # Dart/Flutter analysis
│   │   └── config-parser.ts        # YAML/JSON/TOML configs
│   ├── runners/
│   │   ├── playwright-runner.ts    # Browser UI testing
│   │   ├── test-coverage.ts        # Test coverage analysis
│   │   └── dependency-audit.ts     # npm audit / pip audit
│   ├── api/
│   │   ├── client.ts               # API client to your cloud
│   │   └── offline-rules.ts        # Minimal offline rule set
│   └── reports/
│       └── formatter.ts            # Format results for display
└── dist/                           # Compiled output
```

### 4.3 MCP Tools Exposed to the AI

```typescript
// Tool 1: Full production readiness scan
{
  name: "check_production_readiness",
  description: "Scans the entire project against production readiness checklist",
  input: {
    project_path: string,        // defaults to workspace root
    tech_stack?: string[],       // auto-detected if not provided
    include_ui_tests?: boolean,  // run Playwright/Detox (slower)
    severity_threshold?: "blocker" | "warning" | "info"
  }
}

// Tool 2: Targeted security scan
{
  name: "check_security",
  description: "Deep security audit: JWT, RBAC, secrets, CORS, CSRF, cookies",
  input: { project_path: string }
}

// Tool 3: Check specific file
{
  name: "check_file",
  description: "Check a single file against rules (LOC, patterns, anti-patterns)",
  input: { file_path: string }
}

// Tool 4: UI smoke test
{
  name: "run_ui_smoke_test",
  description: "Tests all buttons, forms, links, and interactive elements",
  input: {
    base_url: string,           // e.g. http://localhost:3000
    test_depth: "shallow" | "deep"
  }
}

// Tool 5: Generate production report
{
  name: "generate_prod_report",
  description: "Generate downloadable production readiness report",
  input: { scan_id: string, format: "md" | "pdf" | "json" }
}
```

### 4.4 What the Local Agent Actually Checks (Static Analysis)

These checks run LOCALLY via AST parsing and file scanning:

**TypeScript/JavaScript checks:**
```typescript
// The agent parses the AST and detects patterns like:
- Files exceeding 500 LOC → count lines per file
- Inline functions in JSX → detect arrow functions in onPress/onClick props
- console.log statements → find all console.* calls
- useEffect for data fetching → detect fetch/axios inside useEffect
- dangerouslySetInnerHTML → search for usage without DOMPurify
- localStorage/sessionStorage for tokens → detect storage.setItem with token-like keys
- Missing error boundaries → check route components for ErrorBoundary wrappers
- SELECT * in raw queries → regex scan for SELECT * in template literals
- N+1 patterns → detect DB calls inside .map()/.forEach()/for loops
- Inline styles in React Native → detect style={{ }} patterns
- Missing Zod/validation → check Server Actions and API routes for validation
- Hardcoded secrets → regex for API_KEY=, SECRET=, password= patterns
- CORS wildcard → detect Access-Control-Allow-Origin: *
```

**Config file checks:**
```typescript
// Reads and validates config files:
- next.config.js → CSP headers present?
- tsconfig.json → strict: true?
- package.json → no console.log babel plugin?
- .env → no secrets in NEXT_PUBLIC_ vars?
- docker-compose.yml → no privileged: true?
- Dockerfile → USER nonroot? No latest tag?
- prisma/schema.prisma → @@index on relations? Decimal for money?
- application.yml → ddl-auto not set to update/create?
- network-security-config.xml → cleartextTrafficPermitted: false?
```

**UI Smoke Testing (Playwright-based):**
```typescript
// Launches headless browser and verifies:
- All buttons are clickable and respond
- All forms submit without JS errors
- All links navigate correctly (no 404s)
- No console errors in browser
- All images load (no broken images)
- All form inputs have labels (a11y)
- Tab navigation works (keyboard a11y)
- Error states display properly (simulate network failure)
- Loading states appear during data fetch
- Mobile responsive check (viewport resize)
```

---

## 5. IP PROTECTION STRATEGIES

### 5.1 The Layered Approach

```
Layer 1: ARCHITECTURE (Primary Protection)
  └─ Core rules and scoring logic ONLY exist on your API server
  └─ Local agent only has scanning capabilities, not the full rule set
  └─ Agent sends findings → API decides severity and scoring

Layer 2: OBFUSCATION (Secondary Protection for Offline Mode)
  └─ Minimal offline rules are compiled and obfuscated
  └─ Rule IDs are hashed (user sees "SEC-001" not the full description)
  └─ JavaScript obfuscation + binary compilation (pkg or nexe)

Layer 3: LICENSE ENFORCEMENT
  └─ Agent phones home for license check on first run and periodically
  └─ Offline grace period (e.g., 7 days) then degrades to basic checks
  └─ Tiered access: Free (basic checks), Pro (full scan), Enterprise (custom rules)

Layer 4: LEGAL
  └─ Terms of service prohibit reverse engineering
  └─ DMCA protection on the rule set
```

### 5.2 What the User SEES vs What They DON'T SEE

**User SEES (in the report):**
```
❌ BLOCKER: JWT uses HS256 — switch to RS256 for production
❌ BLOCKER: 2 files exceed 500 LOC limit (UserDashboard.tsx: 612, CheckoutFlow.tsx: 534)
❌ BLOCKER: Prisma queries inside .map() detected — N+1 pattern in OrderService.ts:45
⚠️  WARNING: No error boundary on /dashboard route
⚠️  WARNING: console.log found in 3 files
✅ PASS: All auth cookies set HttpOnly + Secure + SameSite
✅ PASS: CSRF protection active
✅ PASS: All form inputs have labels (a11y)

Score: 72/100 — NOT PRODUCTION READY (3 blockers)
```

**User DOES NOT SEE:**
- The complete list of all 50+ checks per technology
- Which checks were skipped (not relevant to their stack)
- The scoring weights (security = 3x multiplier vs performance = 1x)
- The full checklist documents
- How the severity is calculated
- What the "next level" checks would be (upsell opportunity)

---

## 6. OFFLINE MODE (FOR ENTERPRISE / LOCAL-ONLY)

For customers who cannot call external APIs:

### 6.1 Encrypted Rule Pack

```
┌─────────────────────────────────────────────────┐
│  Encrypted Rule Pack (.yrp file)                 │
│                                                   │
│  • AES-256 encrypted rules file                  │
│  • Decryption key tied to license key            │
│  • License key is hardware-bound (machine ID)    │
│  • Rules auto-expire after license period        │
│  • New rule pack downloaded on license renewal   │
│                                                   │
│  On first run:                                    │
│  1. User enters license key                      │
│  2. Agent validates key (online check)           │
│  3. Downloads encrypted rule pack                │
│  4. Stores decryption key in OS keychain         │
│  5. Works fully offline until expiry             │
└─────────────────────────────────────────────────┘
```

### 6.2 Degraded Offline Mode (Free Tier)

If no license and no internet, the agent still provides value with a minimal open-source rule set:

```
OFFLINE (FREE):                    ONLINE / LICENSED:
├─ File size check (500 LOC)       ├─ Everything in offline, PLUS:
├─ console.log detection           ├─ Full security audit (50+ checks)
├─ Basic TypeScript strict check   ├─ N+1 query detection
├─ TODO/FIXME scanner              ├─ Architecture pattern analysis
├─ Dependency vulnerability scan   ├─ UI smoke testing orchestration
└─ Basic config validation         ├─ Production scoring & grading
                                   ├─ Detailed fix recommendations
                                   ├─ Historical trend tracking
                                   └─ Team/org dashboards
```

---

## 7. TECH STACK FOR BUILDING THIS

### 7.1 Local Agent (MCP Server)

| Component | Technology | Cost |
|-----------|-----------|------|
| MCP Server | TypeScript + `@modelcontextprotocol/sdk` | Free |
| AST Parsing (TS/JS) | `ts-morph` or `@typescript-eslint/parser` | Free |
| AST Parsing (Python) | `tree-sitter` with Python grammar | Free |
| AST Parsing (Kotlin/Dart) | `tree-sitter` with grammars | Free |
| Config Parsing | Built-in (JSON/YAML/TOML parsers) | Free |
| UI Testing | Playwright (auto-installed) | Free |
| Dependency Audit | `npm audit` / `pip audit` (built-in) | Free |
| Binary Packaging | `pkg` or `nexe` (compile to binary) | Free |
| Distribution | npm registry or direct download | Free |

### 7.2 Cloud API (Rules Engine)

| Component | Technology | Cost |
|-----------|-----------|------|
| API Server | FastAPI (Python) or Hono (TypeScript) | Free |
| Database | PostgreSQL (Supabase free tier) | $0-25/mo |
| Hosting | Railway, Fly.io, or Vercel | $5-20/mo |
| Auth/License | Clerk or custom JWT | $0-25/mo |
| Rule Storage | JSON files in repo or DB | Free |
| **Total MVP** | | **$5-50/mo** |

### 7.3 Estimated Build Time

| Phase | Time | Deliverable |
|-------|------|-------------|
| Phase 1: Core MCP Server | 2-3 weeks | Basic scanning (LOC, console.log, config checks) |
| Phase 2: AST Analysis | 2-3 weeks | N+1 detection, inline function detection, pattern matching |
| Phase 3: Cloud API | 1-2 weeks | Rules engine, scoring, report generation |
| Phase 4: UI Testing | 1-2 weeks | Playwright integration for smoke tests |
| Phase 5: License System | 1 week | Tiered access, offline mode |
| Phase 6: Polish | 1-2 weeks | Documentation, onboarding, error handling |
| **Total MVP** | **8-13 weeks** | **Full working system** |

---

## 8. BUSINESS MODEL

### 8.1 Tiered Pricing

```
FREE (Student / Learning)
├─ Basic checks (LOC, console.log, config validation)
├─ 5 scans per month
├─ Community support
└─ Powered-by badge required

PRO ($19/month per developer)
├─ Full scan (all 17 checklists)
├─ UI smoke testing
├─ Unlimited scans
├─ Fix recommendations
├─ Slack/Discord support
└─ No badge required

ENTERPRISE ($99/month per team)
├─ Everything in Pro
├─ Offline mode (encrypted rule pack)
├─ Custom rule creation
├─ CI/CD integration (GitHub Actions, GitLab CI)
├─ Team dashboard with trends
├─ Priority support
└─ On-premise deployment option
```

### 8.2 CI/CD Integration (Enterprise)

```yaml
# GitHub Actions integration
- name: Production Readiness Check
  uses: your-org/prod-checker-action@v1
  with:
    license-key: ${{ secrets.PROD_CHECKER_KEY }}
    severity-threshold: blocker
    fail-on-blocker: true    # Blocks the PR if blockers found
```

---

## 9. IMPLEMENTATION ROADMAP

### Phase 1: MVP (Weeks 1-4)
**Goal:** Working MCP server that scans a Next.js + Prisma project

Build:
- [ ] MCP server skeleton with `check_production_readiness` tool
- [ ] TypeScript AST parser for: LOC count, console.log, inline functions, N+1 in Prisma
- [ ] Config checker for: tsconfig strict, next.config CSP, .env secrets scan
- [ ] Hardcoded secrets detector (regex-based)
- [ ] Local-only mode with basic open-source rules
- [ ] Markdown report generator

### Phase 2: Cloud Integration (Weeks 5-7)
**Goal:** Rules engine API that enriches local scan results

Build:
- [ ] FastAPI/Hono API with rules engine
- [ ] All 17 checklists loaded as rule sets
- [ ] Scoring and grading logic
- [ ] API authentication (API keys per user)
- [ ] Local agent → API integration (metadata only)

### Phase 3: Multi-Stack Support (Weeks 8-10)
**Goal:** Support all technology stacks

Build:
- [ ] Python AST parser (for FastAPI/Django)
- [ ] Kotlin parser (for Android)
- [ ] Dart parser (for Flutter)
- [ ] Docker/K8s manifest scanner
- [ ] Database config scanner (connection strings, pool size)

### Phase 4: UI Testing & Polish (Weeks 11-13)
**Goal:** Automated UI smoke testing + production polish

Build:
- [ ] Playwright integration for web app testing
- [ ] Button/form/link verification
- [ ] Accessibility checks (axe-core integration)
- [ ] License system
- [ ] Documentation and onboarding flow
- [ ] npm package publishing

---

## 10. ALTERNATIVE: SIMPLER APPROACH (If MCP is too complex initially)

If building a full MCP server feels too heavy for v1, start with a **CLI tool**:

```bash
# Install
npm install -g @your-org/prod-checker

# Run
prod-check scan ./my-nextjs-app

# Output
Scanning ./my-nextjs-app...
Detected: Next.js + TypeScript + Prisma + PostgreSQL

Running 47 checks...

❌ BLOCKER [SEC-001] JWT signed with HS256 (src/lib/auth.ts:42)
❌ BLOCKER [PERF-003] N+1 query detected (src/services/orders.ts:78)
⚠️  WARNING [SEC-012] No CSP headers in next.config.js
⚠️  WARNING [CODE-001] 1 file exceeds 500 LOC (src/app/dashboard/page.tsx: 534)
✅ 43/47 checks passed

Score: 78/100 | Grade: B+ | Status: NOT PRODUCTION READY
Blockers: 2 | Warnings: 2

Full report: ./prod-check-report-2026-02-22.md
```

This CLI can LATER be wrapped as an MCP server with minimal effort since the scanning logic is the same.

---

## 11. DECISION SUMMARY

| Decision | Recommendation | Reason |
|----------|---------------|--------|
| Architecture | Hybrid (local scan + cloud rules) | Protects IP while keeping code local |
| Local tool format | MCP Server (wrapping a CLI) | IDE integration + future-proof |
| Language | TypeScript | Same ecosystem as target users |
| AST parsing | ts-morph + tree-sitter | Covers all languages |
| UI testing | Playwright | Free, reliable, cross-browser |
| Cloud API | FastAPI or Hono on Railway | Cheap, fast to build |
| IP protection | Architecture-first (rules on server) + obfuscation + license | Multi-layered defense |
| Start with | CLI tool → wrap as MCP → add cloud | Incremental, de-risks build |
| First target stack | Next.js + TypeScript + Prisma | Most common combo |

---

## NEXT STEPS

1. **Decide:** CLI-first or MCP-first?
2. **Decide:** Which tech stack to support first (recommend Next.js + Prisma)
3. **Build Phase 1 MVP** (4 weeks)
4. **Test with 5-10 real student projects** to calibrate rules
5. **Add cloud API** for IP-protected scoring
6. **Expand** to remaining tech stacks
