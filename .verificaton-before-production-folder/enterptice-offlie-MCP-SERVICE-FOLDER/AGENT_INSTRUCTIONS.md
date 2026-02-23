# AGENT INSTRUCTIONS — ProdGuard System Integration Guide

## What You Have (3 Projects)

```
prodcheck-cli/               ← CLI tool (npx prodcheck scan .)
├── src/scanners/             ← ALL scanning logic lives here
│   ├── security.ts           ← Hardcoded secrets, JWT, CORS, XSS, SQL injection
│   ├── code-quality.ts       ← LOC limits, console.log, inline functions, TS strict
│   ├── performance.ts        ← N+1, unbounded queries, error handling, health endpoints
│   ├── config.ts             ← Dockerfiles, Prisma schema, next.config, AndroidManifest
│   └── index.ts              ← Scanner registry & orchestrator
├── src/utils/files.ts        ← File discovery, stack detection, stats
├── src/reporters/terminal.ts ← Terminal output + markdown report generation
├── src/types/index.ts        ← All TypeScript types
├── src/cli.ts                ← CLI entry point
└── src/index.ts              ← Library entry (scanProject function)

prodcheck-mcp/                ← Standard MCP server (cloud-scored)
├── src/api/client.ts         ← API client that sends metadata for scoring
├── src/types/index.ts        ← Shared types
└── src/index.ts              ← MCP server with 4 tools

prodcheck-enterprise/         ← Enterprise MCP server (offline, encrypted)
├── src/encryption/license.ts ← AES-256-GCM encryption, machine fingerprinting, license mgmt
├── src/types/                ← (copy from CLI)
└── src/index.ts              ← Enterprise MCP with license activation + offline scoring
```

---

## Step 1: Wire Up the Scanners (CRITICAL — DO THIS FIRST)

Both MCP servers need the scanner code from the CLI. Here's how:

### Option A: Copy the scanner files (Quick — for development)

```bash
# From the prodcheck-mcp directory:
cp -r ../prodcheck-cli/src/scanners/ src/scanners/
cp -r ../prodcheck-cli/src/utils/ src/utils/

# From the prodcheck-enterprise directory:
cp -r ../prodcheck-cli/src/scanners/ src/scanners/
cp -r ../prodcheck-cli/src/utils/ src/utils/
```

After copying, the `performLocalScan` function in both MCP servers will auto-detect
the scanners via the dynamic import and start working.

### Option B: Shared package (Production — recommended)

1. Publish `@prodguard/core` as a private npm package containing:
   - `src/scanners/*`
   - `src/utils/files.ts`
   - `src/types/index.ts`
   - `src/index.ts` (the `scanProject` export)

2. Both MCP servers and the CLI depend on `@prodguard/core`:
   ```json
   "dependencies": {
     "@prodguard/core": "^0.1.0"
   }
   ```

3. Update imports in MCP servers:
   ```typescript
   import { scanProject, discoverFiles, detectStack } from "@prodguard/core";
   ```

---

## Step 2: Install & Test Each Project

### CLI:
```bash
cd prodcheck-cli
npm install
npm run build
node dist/cli.js /path/to/any/project
```

### Standard MCP:
```bash
cd prodcheck-mcp
npm install
npm run build
# Test with MCP Inspector:
npx @modelcontextprotocol/inspector node dist/index.js
```

### Enterprise MCP:
```bash
cd prodcheck-enterprise
npm install
npm run build
# Test with MCP Inspector:
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Step 3: Add to VS Code / Cursor / Claude Desktop

### For Claude Desktop (claude_desktop_config.json):
```json
{
  "mcpServers": {
    "prodguard": {
      "command": "node",
      "args": ["/absolute/path/to/prodcheck-mcp/dist/index.js"],
      "env": {
        "PRODGUARD_API_KEY": "your-api-key"
      }
    }
  }
}
```

### For Cursor (.cursor/mcp.json in project root):
```json
{
  "mcpServers": {
    "prodguard": {
      "command": "node",
      "args": ["./prodcheck-mcp/dist/index.js"],
      "env": {
        "PRODGUARD_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Enterprise version (no API key needed after activation):
```json
{
  "mcpServers": {
    "prodguard-enterprise": {
      "command": "node",
      "args": ["/path/to/prodcheck-enterprise/dist/index.js"],
      "env": {
        "PRODGUARD_LICENSE_KEY": "enterprise-license-key"
      }
    }
  }
}
```

---

## Step 4: Build the Cloud API (for Standard MCP)

The Standard MCP sends scan metadata to your API. You need to build:

### Required API Endpoints:

```
POST /v1/scans
  ← Receives scan metadata
  → Returns scored report with proprietary weights

GET /v1/health
  ← API key in header
  → Returns { plan, scansRemaining, status }

POST /v1/enterprise/activate
  ← { licenseKey, machineId }
  → Returns encrypted rule pack binary (.yrp)
```

### Recommended stack:
- **FastAPI** (Python) or **Hono** (TypeScript) — lightweight, fast
- **PostgreSQL** via Supabase — free tier for MVP
- **Railway or Fly.io** — $5-20/month hosting
- Store all 17 checklist files in the API as JSON rule definitions
- Scoring weights are just a JSON config on the server

### Scoring Engine (your IP):
```python
# Example scoring logic (Python/FastAPI)
CATEGORY_WEIGHTS = {
    "security": 3.0,    # Security failures are 3x more impactful
    "database": 2.0,    # DB issues are 2x
    "error-handling": 1.5,
    "performance": 1.0,
    "code-quality": 0.8,
    "observability": 0.7,
}

SEVERITY_POINTS = {
    "blocker": 15,
    "warning": 5,
    "info": 1,
}

def score_scan(findings):
    score = 100
    for f in findings:
        if f["status"] != "fail":
            continue
        weight = CATEGORY_WEIGHTS.get(f["category"], 1.0)
        points = SEVERITY_POINTS.get(f["severity"], 1)
        score -= points * weight
    return max(0, min(100, round(score)))
```

---

## Step 5: What to Build Next (Priority Order)

### Immediate (Week 1-2):
- [ ] Copy scanner files into both MCP servers
- [ ] Test full scan with a real Next.js + Prisma project
- [ ] Calibrate rules — reduce false positives
- [ ] Add more TypeScript-specific checks (missing return types, unused vars)

### Short-term (Week 3-4):
- [ ] Build the cloud API (FastAPI + Supabase)
- [ ] Implement API key authentication
- [ ] Implement the scoring engine with proprietary weights
- [ ] Build the `/enterprise/activate` endpoint

### Medium-term (Week 5-8):
- [ ] VS Code Extension wrapper (calls CLI under the hood)
- [ ] Playwright UI testing integration
- [ ] Python/Django scanner (AST with tree-sitter)
- [ ] Java/Spring Boot scanner
- [ ] CI/CD GitHub Action

### Long-term (Week 9+):
- [ ] Flutter/Dart scanner
- [ ] Kotlin Android scanner
- [ ] Team dashboards and trends
- [ ] Custom rule creation for enterprise
- [ ] Stripe integration for billing

---

## Architecture Reminders

### WHAT STAYS ON THE USER'S MACHINE:
- All source code (NEVER sent anywhere)
- The scanning process (AST parsing, regex matching, config reading)
- The CLI/MCP binary itself

### WHAT GOES TO YOUR SERVER (Standard):
- Scan metadata: rule IDs, pass/fail, file paths, line numbers, stats
- NEVER source code, NEVER file contents

### WHAT STAYS ON YOUR SERVER (Your IP):
- All 17 checklist documents
- All 18 skills/framework documents
- Scoring weights and severity classification
- Full rule definitions and detection logic descriptions
- Report templates and recommendation text
- User analytics and aggregate data

### WHAT THE USER SEES:
- Targeted pass/fail results for THEIR code only
- Fix recommendations for failures
- Score and grade
- They do NOT see the full rule set, scoring formula, or other checks

### ENTERPRISE DIFFERENCE:
- Rules are encrypted and stored locally (.yrp file)
- License key + machine ID required for decryption
- Works 100% offline after activation
- Same scanning, same scoring, zero network calls
- Rule packs expire with the license — auto-renewal downloads new pack
