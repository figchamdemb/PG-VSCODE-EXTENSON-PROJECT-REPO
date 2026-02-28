# Slack Transport Check

UTC: 2026-02-26T13:43:40.5899396Z
API Base: http://127.0.0.1:8787
Thread ID: 73242e12-72d9-40b4-8289-6b339c8332da

- PASS: 12
- FAIL: 0

## PASS - Local health endpoint

```text
{"ok":true}
```

## PASS - Local Slack health endpoint

```text
{"ok":true,"commands_enabled":true,"has_signing_secret":true,"has_bot_token":true,"has_webhook_url":false,"team_allowlist_enabled":false,"email_allowlist_enabled":false}
```

## PASS - Public health endpoint

```text
Skipped by flag (-SkipPublicChecks).
```

## PASS - Public Slack health endpoint

```text
Skipped by flag (-SkipPublicChecks).
```

## PASS - Governance state token

```text
State file loaded: C:\Users\ebrim\Desktop\PG VSCODE-EXTENSION\Memory-bank\_generated\governance-agent-state.json
```

## PASS - Account summary auth

```text
{"ok":true,"plan":"team","email":"extensionpgglobal@gmail.com"}
```

## PASS - Create governance thread

```text
{"ok":true,"thread_id":"73242e12-72d9-40b4-8289-6b339c8332da","vote_mode":"majority","options":[{"option_key":"opt1","title":"approve","rationale":"ship now"},{"option_key":"opt2","title":"needs-change","rationale":"adjust first"}]}
```

## PASS - Vote thread (opt1)

```text
{"ok":true,"tally":[{"option_key":"opt1","title":"approve","votes":1,"weight":1},{"option_key":"opt2","title":"needs-change","votes":0,"weight":0}]}
```

## PASS - Finalize decision

```text
{"ok":true,"outcome":{"id":"96f5a977-9509-4c53-8394-b309c17a8ba0","thread_id":"73242e12-72d9-40b4-8289-6b339c8332da","team_id":"321a1f15-a6d6-4ba5-bed4-98f7b7a766c2","title":"10F Transport Check 2026-02-26 13:42:44","decision":"approve","winning_option_key":"opt1","decision_note":"transport check decide","decided_by_email":"extensionpgglobal@gmail.com","decided_at":"2026-02-26T13:43:12.802Z","created_at":"2026-02-26T13:43:12.802Z"}}
```

## PASS - Bind thread action key

```text
Binding command completed.
```

## PASS - Run governance worker once

```text
Worker command completed.
```

## PASS - Verify ack applied

```text
{"summary":"10F Transport Check 2026-02-26 13:42:44 -> approve (opt1)","thread_id":"73242e12-72d9-40b4-8289-6b339c8332da","recovery_worker_output":"","sequence":24,"recovery_attempted":false,"acked_at":"2026-02-26T13:43:26.334Z","recovery_cursor_reset_to":null,"ack_status":"applied","event_id":"d3021b13-0589-4830-a275-f60d2a773eef","recovery_error":""}
```

