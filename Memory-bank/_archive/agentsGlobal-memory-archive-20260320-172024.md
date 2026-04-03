# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 17:20
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 23


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-100116.md` on 2026-03-20 10:01 UTC.


Validation:
- `GET /health` on `127.0.0.1:8787`: PASS
- browser-context `POST /auth/email/start`: PASS
- browser-context `POST /auth/email/verify` with fresh code + install_id: PASS

Anchors:
- `server/.env`
- `server/public/assets/site.js`
- `server/src/authEmailVerifySupport.ts`

### [2026-03-20 19:18 UTC] - copilot
Scope:
- Components: portal-auth-card-click-targets, smoke-auth-focus-check
- Files touched: portal auth markup/js/css + smoke test

Summary:
- Reproduced the `/app` click complaint with MCP browser tooling and confirmed the sign-in page had no blocking overlay; the dead area came from static `article.card` containers with no card-level interaction.
- Added `auth-card` click handling so empty-card clicks now focus the primary auth control while preserving native button/input clicks.
- Added a smoke assertion proving that clicking the email auth card body focuses `#emailInput` before the sign-in flow continues.
