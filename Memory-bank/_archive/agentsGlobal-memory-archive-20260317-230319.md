# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-17 23:03
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 24


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260317-221310.md` on 2026-03-17 22:13 UTC.

### [2026-03-17 23:50 UTC] - copilot
Scope:
- Components: local-auth-doc-clarification, milestone-16c-closeout
- Files touched: auth testing docs, env example comments, planning memory files

Summary:
- Clarified the real local auth-test behavior so operators can use both supported paths instead of reading the docs as dev-code-only.
- `ENABLE_EMAIL_OTP=true` is now documented as the normal local verification path where `/app` and the extension prompt accept manually entered codes.
- `EXPOSE_DEV_OTP_CODE=true` is now documented as the optional local-only shortcut that exposes `dev_code` from `/auth/email/start` for immediate testing when no external delivery path is configured.
- Closed `Milestone 16C` in planning memory because the repo now matches the user requirement across enforcement, operator docs, and Memory-bank records.

Validation:
- Pending `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck` and strict rerun after this doc and memory sync batch.

Anchors:
- `docs/FRONTEND_INTEGRATION_PROTOCOL_PROPOSAL.md`
- `docs/TESTING_GUIDE.md`
- `server/.env.example`
- `Memory-bank/project-details.md`
- `Memory-bank/tools-and-commands.md`
