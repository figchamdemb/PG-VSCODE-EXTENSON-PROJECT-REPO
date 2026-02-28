# Architecture Decisions & Answers — Production Checker System

## Your Questions Answered

---

### Q1: Can they see the skills/framework rules (MUST DO / MUST NOT DO)?

**NO. They should NEVER see the full rules.** Here's exactly what they see vs don't:

```
WHAT THE USER SEES                          WHAT STAYS HIDDEN (YOUR IP)
──────────────────                          ──────────────────────────
❌ "N+1 query detected at line 45"          The full list of 50+ checks per tech
❌ "JWT uses HS256, use RS256"              The scoring weights (security = 3x)
✅ "CSRF protection: PASS"                  The complete checklist documents
                                            Which checks were skipped
Score: 72/100                               How the score is calculated
"3 blockers, fix before production"         The detection algorithms
                                            What other stacks would check
```

**The user gets targeted feedback, not the encyclopedia.** They see "you failed this" and "fix it like this" — but they never see the master list of everything being checked. This is like a driving test — you get told what you failed, not given the examiner's full scoring manual.

---

### Q2: How does the encryption work for enterprise/offline?

**You do NOT need RSA for this.** Here's why and what to use instead:

```
OPTION A: EVERYTHING BEHIND SERVER (RECOMMENDED FOR $10/YEAR TIER)
═══════════════════════════════════════════════════════════════════

User runs CLI/Extension → Scans code locally → Sends metadata to YOUR server
                                                        ↓
                                          Server has ALL rules (never shared)
                                          Server scores and returns results
                                                        ↓
                                          User gets pass/fail report only

IP Protection: 100% — rules NEVER leave your server
Cost to user: Needs internet (fine for students at $10/year)
```

```
OPTION B: ENCRYPTED OFFLINE PACK (FOR ENTERPRISE AT $99+/MONTH)
════════════════════════════════════════════════════════════════

1. Enterprise buys license → gets a LICENSE KEY
2. License key is tied to their machine ID (hardware fingerprint)
3. On first run, agent downloads ENCRYPTED rule pack from your server
4. Rule pack is AES-256 encrypted
5. Decryption key = derived from (LICENSE KEY + MACHINE ID + YOUR SECRET SALT)
6. Only YOUR agent binary knows the SALT (compiled + obfuscated)
7. Rules are decrypted IN MEMORY only — never written to disk unencrypted
8. Rule pack has an EXPIRY DATE — stops working when license expires

Can they crack it?
- They'd need to reverse-engineer the compiled binary to find the SALT
- Even then, rules are decrypted only in memory during scan execution
- Practical security: Very high. Not NSA-proof, but enough to stop copying.
- Legal protection adds another layer (DMCA + Terms of Service)
```

**My recommendation:** Start with Option A only (server-side). At $10/year for students, they WILL have internet. Add Option B later when you actually have enterprise customers paying $99+/month. Don't over-engineer encryption now.

---

### Q3: How does the VS Code extension work with the CLI?

```
┌──────────────────────────────────────────────────────────┐
│                    VS CODE / CURSOR                       │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  YOUR EXTENSION ("ProdChecker")                      │ │
│  │                                                       │ │
│  │  Sidebar Panel:                                       │ │
│  │  ┌─────────────────────────────────────┐             │ │
│  │  │  🔴 3 Blockers  🟡 5 Warnings       │             │ │
│  │  │                                      │             │ │
│  │  │  Score: 72/100 — NOT READY           │             │ │
│  │  │                                      │             │ │
│  │  │  ❌ SEC-001: JWT HS256 (auth.ts:42)  │             │ │
│  │  │  ❌ PERF-003: N+1 (orders.ts:78)     │             │ │
│  │  │  ❌ CODE-001: 534 LOC (dashboard.tsx)│             │ │
│  │  │  ⚠️  SEC-012: No CSP headers         │             │ │
│  │  │  ⚠️  CODE-002: console.log (3 files) │             │ │
│  │  │                                      │             │ │
│  │  │  [🔍 Scan Now]  [📄 Full Report]    │             │ │
│  │  └─────────────────────────────────────┘             │ │
│  │                                                       │ │
│  │  Under the hood:                                      │ │
│  │  1. Extension spawns CLI: `npx prodcheck scan .`     │ │
│  │  2. CLI scans files locally (AST + regex + config)   │ │
│  │  3. CLI sends metadata to YOUR API                   │ │
│  │  4. API returns scored results                       │ │
│  │  5. Extension displays results in sidebar            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  Also integrates with:                                    │
│  • Status bar: "ProdCheck: 3 blockers" (always visible)  │
│  • Problems panel: Issues show as warnings/errors        │
│  • Red squiggly underlines on problem lines              │
│  • Code Actions: "Fix: Extract to custom hook" (auto)    │
│  • Pre-commit hook: Block commit if blockers exist       │
│  • Terminal: `npx prodcheck scan` works standalone too   │
└──────────────────────────────────────────────────────────┘
```

The extension is a THIN WRAPPER around the CLI. The CLI does all the work. This means:
- Students can use just the CLI (`npx prodcheck scan .`) without VS Code
- Enterprise can use the VS Code extension for rich UI
- Both use the same scanning engine
- You build the CLI once, wrap it twice (extension + MCP)

---

### Q4: How does Playwright work for UI testing? Is it really free?

**Yes, Playwright is 100% free and open source (Apache 2.0 license).** You can use it commercially, charge for products built with it, no royalties.

Here's how UI testing works in the flow:

```
BACKEND CHECKS (don't need running app):
├── Static analysis (AST parsing) — reads files directly
├── Config validation — reads config files
├── Dependency audit — reads package.json
├── Security patterns — scans for secrets, SQL injection patterns
└── These run in 5-30 seconds

FRONTEND CHECKS (need running app):
├── User starts their dev server: `npm run dev`
├── Extension detects running server OR asks for URL
├── Playwright launches headless browser
├── Tests automatically:
│   ├── Every <button> — clicks it, checks no JS error
│   ├── Every <a> link — navigates, checks no 404
│   ├── Every <form> — submits empty (validates error states shown)
│   ├── Every <input> — checks it has a <label> (a11y)
│   ├── Console errors — captures any JS errors during navigation
│   ├── Images — checks all load (no broken images)
│   ├── Responsive — resizes to mobile/tablet/desktop
│   └── Network errors — simulates offline, checks graceful handling
├── Results sent back to the scoring engine
└── These run in 30-120 seconds
```

The key insight: **backend checks and frontend checks are separate passes.** The CLI runs backend checks first (fast, no server needed), then optionally runs frontend checks if a dev server is running.

```bash
# Backend only (fast)
npx prodcheck scan .

# Backend + Frontend (needs running app)
npx prodcheck scan . --ui-test --url http://localhost:3000

# Or in the VS Code extension, there's just a toggle:
# ☑️ Include UI smoke tests
```

---

### Q5: How does the "describe what you want, get rules" flow work?

This is the MCP / AI integration path. Here's the flow:

```
STUDENT IN CURSOR/CLAUDE:
─────────────────────────
Student: "I want to build a microservice in Java Spring Boot 
          with PostgreSQL and Redis"

AI + YOUR MCP SERVER:
─────────────────────
1. MCP tool `init_project_rules` is called
2. Sends to YOUR API: { stack: ["java-spring-boot", "postgresql", "redis"] }
3. YOUR API returns (to the AI only, not displayed raw):
   - Active rule IDs for this stack (not the full descriptions)
   - Architecture guidance summary (what the AI should enforce)
   - Key constraints (4-layer architecture, connection pooling required, etc.)
4. AI now KNOWS the rules and enforces them while coding WITH the student
5. If student writes a fat controller → AI says "Move this to Service layer"
6. If student writes N+1 → AI catches it immediately

Student: "Check if my code is production ready"

1. MCP tool `check_production_readiness` is called
2. Local scan runs → metadata sent to API
3. API scores against Java + PostgreSQL + Redis checklists
4. Report returned to AI → AI presents results conversationally:

AI: "I scanned your project and found 2 blockers:
     1. Your HikariCP pool size is set to 50 which is too high 
        for your 4-core server. Should be around 10.
     2. You're missing circuit breakers on the PaymentGateway 
        calls. If their API goes down, your entire service hangs.
     
     Want me to fix these?"
```

**The beauty:** The AI sees enough context to HELP, but the student never sees the raw checklist. The rules are embedded in the AI's behavior, not shown as a document.

---

### Q6: Cost analysis at $10/year per student

```
YOUR COSTS PER STUDENT:
────────────────────────
API hosting (Railway/Fly.io): ~$0.001 per scan (compute)
Database (Supabase free/pro): ~$0.0001 per scan (storage)
Bandwidth: ~$0.0005 per scan

Average student: ~50 scans/year
Cost per student per year: ~$0.08

Revenue per student: $10/year
Gross margin: 99.2%

At 1,000 students: $10,000 revenue / ~$80 cost + ~$300 infra fixed = $9,620 profit
At 10,000 students: $100,000 revenue / ~$800 cost + ~$600 infra = $98,600 profit

The economics are extremely favorable at $10/year.
```

The main cost is YOUR TIME building it, not the infrastructure.

---

## FINAL ARCHITECTURE DECISION

```
BUILD ORDER:
════════════

WEEK 1-4: CLI Tool (Phase 1)
├── npx prodcheck scan .
├── TypeScript/Next.js/Prisma scanner
├── Calls YOUR API for scoring (rules server-side)
├── Returns pass/fail report in terminal
└── This is your MVP. Ship it. Get feedback.

WEEK 5-8: VS Code Extension (Phase 2)
├── Wraps the CLI
├── Sidebar panel with results
├── Inline error highlights
├── Pre-commit hook integration
└── This is your monetization vehicle.

WEEK 9-12: MCP Server + More Stacks (Phase 3)
├── Wraps the same CLI for AI integration
├── Add Java, Python, Flutter, Kotlin parsers
├── Playwright UI testing integration
└── This is your differentiation.

LATER: Enterprise Features
├── Encrypted offline rule packs
├── CI/CD GitHub Action
├── Team dashboards
└── Custom rule creation
```

---

## SCALABILITY GUIDE PLACEMENT DECISION (2026-02-26)

The scalability decision framework is now placed in three layers:

1. **Canonical policy doc (repo-visible):**
   - `.verificaton-before-production-folder/SCALABILITY_ARCHITECTURE_GUIDE.md`
   - Purpose: explicit discovery questions + anti-pattern bans + architecture selection rules.

2. **Milestone-backed enforcement rollout:**
   - `Memory-bank/project-details.md` -> **Milestone 10N**
   - Purpose: move from reference-doc usage to enforced pre-build decision gate.

3. **Server-side private policy profile (planned execution layer):**
   - integrated with existing private policy vault approach (same model as dependency/coding policy).
   - Purpose: AI receives rule IDs/outcomes and required questionnaire flow without exposing full private logic to users.

### Runtime Rule (adopted)

For any feature involving real-time updates, async jobs, service communication, or distributed state:

- agent must ask scalability discovery questions first;
- agent must present options + rejection rationale;
- agent must request user confirmation on architecture choice before coding.
