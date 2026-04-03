# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-20 10:01
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 22


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260320-062806.md` on 2026-03-20 06:28 UTC.


Validation:
- `GET /health` on `127.0.0.1:8787`: PASS
- local `/auth/github/start?...callback_url=http://127.0.0.1:...` redirect: PASS
- local `/auth/google/start?...callback_url=http://127.0.0.1:...` redirect: PASS

Anchors:
- `server/.env`
- `docs/TESTING_GUIDE.md`
- `Memory-bank/tools-and-commands.md`

### [2026-03-20 19:00 UTC] - copilot
Scope:
- Components: local-email-auth-rate-limit, browser-flow-validation
- Files touched: local auth config + docs

Summary:
- Reproduced the `/app` email-login path directly from the browser context and found the real blocker was `429 Rate limit exceeded, retry in 5 hours` on `/auth/email/verify`.
- Relaxed the local-only verify limiter in `server/.env` to `50 / 15 minutes`, restarted the backend, and confirmed the browser-style `start -> verify` flow now returns `200` with a real access token.
