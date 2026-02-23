# DB Schema - licensing-json-store

LAST_UPDATED_UTC: 2026-02-21 23:40
UPDATED_BY: codex

## Purpose
Document JSON runtime schema used by the licensing backend when `STORE_BACKEND=json` (or as fallback reference for `STORE_BACKEND=prisma` payload compatibility).

## Migration Source
- Path: `server/src/types.ts`, `server/src/store.ts`
- Latest migration: in-code schema evolution via `normalizeLoadedState(...)`

## Tables (Index)
| Table | Purpose | Primary Key | Notes |
|---|---|---|---|
| `users` | account identity | `id` | email normalized lowercase |
| `auth_challenges` | email OTP challenge | `id` | short-lived verification code |
| `sessions` | bearer session tokens | `token` | expires via `expires_at` |
| `subscriptions` | active/expired/revoked/refunded plan grants | `id` | includes optional `team_id` |
| `product_entitlements` | narrate/memorybank/bundle module toggles | `id` | aligned with subscription period |
| `project_quotas` | yearly project allowance | `id` | scope currently `memorybank` |
| `project_activations` | idempotent project consumption records | `id` | unique behavior by `(user_id, scope, repo_fingerprint)` |
| `devices` | install binding + revoke state | `id` | enforced against plan device limit |
| `trials` | one-time trial history | `user_id` | 48h trial window |
| `refund_requests` | refund workflow records | `id` | links subscription |
| `offline_payment_refs` | manual payment reference lifecycle | `id` | pending/submitted/approved/rejected |
| `redeem_codes` | redeemable entitlement grants | `id` | unused/used/revoked |
| `stripe_events` | webhook idempotency ledger | `id` | dedupe by `event_id` |
| `affiliate_codes` | user affiliate code registry | `id` | commission bps per code |
| `affiliate_conversions` | referral conversion timeline | `id` | payout linkage via `payout_id` |
| `affiliate_payouts` | affiliate payout approval history | `id` | amount aggregated from pending conversions |
| `provider_policies` | provider governance by user/team scope | `id` | local-only/byo/allow/deny policy |
| `oauth_states` | GitHub/Google OAuth state tracking | `id` | state token expiry + one-time consume |
| `teams` | team/enterprise group metadata | `id` | seat limit + module scope |
| `team_memberships` | team seat assignments | `id` | active/revoked membership |
| `support_tickets` | customer support requests | `id` | category/severity/status lifecycle |
| `feedback_entries` | customer product ratings/notes | `id` | 1-5 rating + optional message |
| `governance_settings` | scope-level governance controls | `id` | retention/vote/slack policy by user/team scope |
| `governance_eod_reports` | end-of-day progress reports | `id` | human/agent report stream with changed-files + blockers |
| `mastermind_threads` | debate threads | `id` | open/decided lifecycle and final ruling fields |
| `mastermind_options` | thread vote options | `id` | option set per mastermind thread |
| `mastermind_entries` | debate comments/arguments | `id` | argument/suggestion/review timeline |
| `mastermind_votes` | per-user vote ledger | `id` | one active vote record per user/thread (upsert behavior) |
| `mastermind_outcomes` | immutable decision summary | `id` | preserved outcome even when thread payload is pruned |
| `governance_decision_events` | local-sync decision queue | `id` | ordered sequence for client pull/ack |
| `governance_decision_acks` | decision apply acknowledgments | `id` | pending/applied/conflict/skipped per user/event |
| `keys` | JWT signing keypair | n/a | ES256 private/public PEM |

## Tables (Columns)
### table: subscriptions
| column | type | constraints | description |
|---|---|---|---|
| `id` | string | required | unique subscription id |
| `user_id` | string | required | owner account id |
| `plan_id` | enum | `pro|team|enterprise` | paid plan tier |
| `team_id` | string/null | nullable | linked team seat grant |
| `status` | enum | `active|expired|revoked|refunded` | lifecycle state |
| `starts_at` | ISO datetime | required | start time |
| `ends_at` | ISO datetime | required | expiry |
| `refund_window_ends_at` | ISO datetime | required | refund eligibility boundary |
| `source` | enum | `stripe|offline|manual` | grant source |

### table: provider_policies
| column | type | constraints | description |
|---|---|---|---|
| `scope_type` | enum | `user|team` | policy scope class |
| `scope_id` | string | required | user id or team id |
| `local_only` | boolean | required | force localhost providers only |
| `byo_allowed` | boolean | required | allow arbitrary provider endpoints |
| `allowlist` | string[] | optional | allowed host fragments |
| `denylist` | string[] | optional | denied host fragments |

### table: oauth_states
| column | type | constraints | description |
|---|---|---|---|
| `state` | string | unique expected | oauth anti-forgery state token |
| `provider` | enum | `github|google` | oauth provider |
| `install_id` | string/null | nullable | extension install id |
| `callback_url` | string/null | nullable | trusted callback url (loopback or allowed origin) |
| `expires_at` | ISO datetime | required | oauth state expiry |
| `consumed_at` | ISO datetime/null | nullable | one-time state consume timestamp |

### table: teams
| column | type | constraints | description |
|---|---|---|---|
| `team_key` | string | unique expected | admin-facing team identifier |
| `owner_user_id` | string | required | team owner account |
| `plan_id` | enum | `team|enterprise` | team plan |
| `module_scope` | enum | `narrate|memorybank|bundle` | module scope for assigned seats |
| `seat_limit` | number | >=1 | max active seats |

### table: team_memberships
| column | type | constraints | description |
|---|---|---|---|
| `team_id` | string | required | owning team |
| `user_id` | string | required | assigned account |
| `role` | enum | `owner|manager|member` | seat role |
| `status` | enum | `active|revoked` | membership state |
| `invited_email` | string/null | nullable | original invited email |
| `revoked_at` | ISO datetime/null | nullable | revoke timestamp |

### table: support_tickets
| column | type | constraints | description |
|---|---|---|---|
| `id` | string | required | unique ticket id |
| `user_id` | string | required | submitting account id |
| `email` | string | required | submitting account email |
| `category` | enum | `support|billing|bug|feature` | ticket class |
| `severity` | enum | `low|medium|high` | priority tier |
| `subject` | string | required | short issue title |
| `message` | string | required | full issue details |
| `status` | enum | `open|in_progress|resolved|closed` | ticket lifecycle |
| `resolution_note` | string/null | nullable | internal resolution summary |
| `created_at` | ISO datetime | required | create timestamp |
| `updated_at` | ISO datetime | required | last update timestamp |

### table: feedback_entries
| column | type | constraints | description |
|---|---|---|---|
| `id` | string | required | unique feedback id |
| `user_id` | string | required | submitting account id |
| `email` | string | required | account email |
| `rating` | enum-number | `1..5` | satisfaction score |
| `message` | string/null | nullable | optional free text |
| `created_at` | ISO datetime | required | create timestamp |

### table: governance_settings
| column | type | constraints | description |
|---|---|---|---|
| `scope_type` | enum | `user|team` | settings target scope |
| `scope_id` | string | required | user id or team id |
| `slack_enabled` | boolean | required | whether slack dispatch is enabled |
| `slack_addon_active` | boolean | required | paid add-on activation gate |
| `slack_channel` | string/null | nullable | preferred channel id/name |
| `vote_mode` | enum | `majority|single_reviewer` | default vote model for new threads |
| `max_debate_chars` | number | clamped | max text length for thread/entry/vote rationale |
| `retention_days` | number | clamped | data pruning window for mutable governance data |

### table: governance_eod_reports
| column | type | constraints | description |
|---|---|---|---|
| `user_id` | string | required | submitting actor |
| `email` | string | required | actor email snapshot |
| `team_id` | string/null | nullable | optional team scope |
| `title` | string | required | report title |
| `summary` | string | required | report content |
| `work_started_at` | ISO datetime/null | nullable | optional work start |
| `work_ended_at` | ISO datetime/null | nullable | optional work end |
| `changed_files` | string[] | optional | changed file list |
| `blockers` | string[] | optional | blocker list |
| `source` | enum | `agent|human` | report source type |
| `agent_name` | string/null | nullable | optional agent label |
| `created_at` | ISO datetime | required | create timestamp |
| `updated_at` | ISO datetime | required | update timestamp |

### table: mastermind_threads
| column | type | constraints | description |
|---|---|---|---|
| `team_id` | string/null | nullable | null for personal scope, team id for enterprise scope |
| `created_by_user_id` | string | required | thread creator |
| `title` | string | required | thread title |
| `question` | string | required | debate prompt/context |
| `status` | enum | `open|decided|closed` | lifecycle state |
| `vote_mode` | enum | `majority|single_reviewer` | vote strategy |
| `decision` | enum/null | nullable | final ruling |
| `decision_option_key` | string/null | nullable | winning option key |
| `decision_note` | string/null | nullable | final decision note |
| `decided_by_user_id` | string/null | nullable | finalizer id |
| `decided_by_email` | string/null | nullable | finalizer email |
| `decided_at` | ISO datetime/null | nullable | finalization time |
| `last_activity_at` | ISO datetime | required | latest thread activity |
| `expires_at` | ISO datetime | required | prune boundary |

### table: governance_decision_events
| column | type | constraints | description |
|---|---|---|---|
| `sequence` | number | monotonic | pull cursor order for local clients |
| `event_type` | enum | `decision_finalized` | sync event class |
| `thread_id` | string | required | source thread |
| `team_id` | string/null | nullable | optional team scope |
| `decision` | enum | `approve|reject|needs_change` | final ruling |
| `winning_option_key` | string/null | nullable | selected option key |
| `summary` | string | required | concise decision digest |
| `created_at` | ISO datetime | required | create timestamp |
| `expires_at` | ISO datetime | required | event retention boundary |
