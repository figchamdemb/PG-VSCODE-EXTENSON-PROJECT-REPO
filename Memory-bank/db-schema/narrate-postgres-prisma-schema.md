# DB Schema - narrate-postgres-prisma

LAST_UPDATED_UTC: 2026-03-18 03:54
UPDATED_BY: copilot

## Purpose
Document the canonical PostgreSQL target for the Narrate licensing domain and the Prisma-managed core tables inside it.

## Location
- Database: `narate-enterprise`
- Schema: `narate_enterprise` (non-`public`)
- Provisioning command: `npm run prisma:dbpush` with `DATABASE_URL=...?...schema=narate_enterprise`
- Prisma model source: `server/prisma/schema.prisma`
- Legacy location `egov.narrate` is retired and must not be used for runtime or tool configuration.

## Prisma Core Tables (28)
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
- `narate-enterprise?schema=narate_enterprise` is the only supported Postgres runtime target for this repo.
- The dedicated enterprise schema may also contain additional runtime-managed tables created outside `schema.prisma` by the server store bootstrap path; this file tracks only the 28 Prisma models above.
- `oauth_states.provider` supports both `github` and `google`.
- `team_memberships.role` supports `owner|manager|member`.
- Index hardening batch (2026-02-27) added missing Prisma-side indexes on relational FK-like fields to satisfy coding/DB policy gates:
  - `subscriptions(plan_id)`, `subscriptions(team_id)`
  - `refund_requests(subscription_id)`
  - `offline_payment_refs(plan_id)`
  - `redeem_codes(plan_id)`, `redeem_codes(used_by_user_id)`
  - `affiliate_codes(user_id)`
  - `affiliate_conversions(buyer_user_id)`, `affiliate_conversions(order_id)`, `affiliate_conversions(payout_id)`
  - `oauth_states(install_id)`
  - `teams(owner_user_id)`, `teams(plan_id)`
- Admin/operator identities are isolated from customer identities:
  - customer identities remain in `users`
  - board/admin/shop-assistant control plane lives in `admin_*` tables
- Runtime API supports `STORE_BACKEND=prisma` for live table-by-table persistence in `narate_enterprise.*`.
- Runtime API also supports `STORE_BACKEND=json` fallback for local testing/recovery.
