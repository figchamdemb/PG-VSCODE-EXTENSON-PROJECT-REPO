# DB Schema - narrate-postgres-prisma

LAST_UPDATED_UTC: 2026-02-21 23:58
UPDATED_BY: codex

## Purpose
Document the PostgreSQL schema provisioned by Prisma for Narrate licensing domain.

## Location
- Database: `narate-enterprise`
- Schema: `narate_enterprise` (non-`public`)
- Provisioning command: `npm run prisma:dbpush` with `DATABASE_URL=...?...schema=narate_enterprise`
- Prisma model source: `server/prisma/schema.prisma`

## Provisioned Tables (28)
- `users`
- `auth_challenges`
- `sessions`
- `subscriptions`
- `product_entitlements`
- `project_quotas`
- `project_activations`
- `devices`
- `trials`
- `refund_requests`
- `offline_payment_refs`
- `redeem_codes`
- `stripe_events`
- `affiliate_codes`
- `affiliate_conversions`
- `affiliate_payouts`
- `provider_policies`
- `oauth_states`
- `teams`
- `team_memberships`
- `admin_accounts`
- `admin_roles`
- `admin_permissions`
- `admin_role_permissions`
- `admin_scopes`
- `admin_account_roles`
- `admin_audit_logs`
- `keys`

## Notes
- `oauth_states.provider` supports both `github` and `google`.
- `team_memberships.role` supports `owner|manager|member`.
- Admin/operator identities are isolated from customer identities:
  - customer identities remain in `users`
  - board/admin/shop-assistant control plane lives in `admin_*` tables
- Runtime API supports `STORE_BACKEND=prisma` for live table-by-table persistence in `narate_enterprise.*`.
- Runtime API also supports `STORE_BACKEND=json` fallback for local testing/recovery.
