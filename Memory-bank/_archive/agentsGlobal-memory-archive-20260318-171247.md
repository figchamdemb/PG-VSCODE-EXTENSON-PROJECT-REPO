# Archive from agentsGlobal-memory.md

GENERATED_UTC: 2026-03-18 17:12
SOURCE_FILE: Memory-bank/agentsGlobal-memory.md
REMOVED_LINES: 35


> Older entries archived to `Memory-bank/_archive/agentsGlobal-memory-archive-20260318-043726.md` on 2026-03-18 04:37 UTC.


### [2026-03-18 16:56 UTC] - copilot
Scope:
- Components: stripe-runtime-secret-hardening, env-only-defaults, encrypted-admin-persistence
- Files touched: Stripe runtime server modules + env/operator docs + planning memory files

Summary:
- Hardened Stripe runtime secret handling so the default shared path is env/vault-first instead of plaintext runtime JSON.
- Added an encrypted-at-rest persistence path for super-admin board secret updates behind `STRIPE_RUNTIME_VAULT_KEY`.
- Kept the admin/browser contract hint-only: masked key placeholders still render, but raw secret values are not returned.
- Added forward-compatible legacy handling so old plaintext runtime files remain readable and can be migrated after the vault key is configured.

Validation:
- `npm run build` (server): PASS
- `./pg.ps1 map-structure`: PASS
- `./pg.ps1 self-check -WarnOnly -EnableDbIndexMaintenanceCheck`: PASS
- `./pg.ps1 self-check -EnableDbIndexMaintenanceCheck`: PASS

Anchors:
- `server/src/secretEnvelopeCrypto.ts`
- `server/src/stripeRuntimeManager.ts`
- `server/src/stripeRuntimeStorage.ts`
- `server/src/index.ts`
- `server/src/productionReadiness.ts`
- `server/.env.example`
- `server/README.md`
- `Memory-bank/project-spec.md`
- `Memory-bank/project-details.md`
- `Memory-bank/tools-and-commands.md`
- `Memory-bank/structure-and-db.md`
- `Memory-bank/daily/2026-03-18.md`
