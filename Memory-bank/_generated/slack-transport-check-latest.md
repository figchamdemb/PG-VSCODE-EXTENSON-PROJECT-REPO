# Slack Transport Check

UTC: 2026-03-19T09:23:32.0510606Z
API Base: http://127.0.0.1:8787
Public Base: https://pg-ext.addresly.com
Thread ID: 8fcb4ac1-b483-4b6a-98f0-bcf90bc4b288

- PASS: 10
- FAIL: 2

## PASS - Local health endpoint

```text
{"ok":true,"uptime_seconds":11745,"node_env":"development"}
```

## PASS - Local Slack health endpoint

```text
{"ok":true,"commands_enabled":true,"has_signing_secret":true,"has_bot_token":true,"has_webhook_url":false,"team_allowlist_enabled":false,"email_allowlist_enabled":false}
```

## FAIL - Public health endpoint

```text
Response status code does not indicate success: 530 (<none>).
```

## FAIL - Public Slack health endpoint

```text
Response status code does not indicate success: 530 (<none>).
```

## PASS - Governance state token

```text
State file loaded: C:\Users\ebrim\Desktop\PG VSCODE-EXTENSION\Memory-bank\_generated\governance-agent-state.json
```

## PASS - Account summary auth

```text
{"ok":true,"email":"extensionpgglobal@gmail.com","plan":"team"}
```

## PASS - Create governance thread

```text
{"ok":true,"thread_id":"8fcb4ac1-b483-4b6a-98f0-bcf90bc4b288","vote_mode":"majority","options":[{"option_key":"opt1","title":"approve","rationale":"ship now"},{"option_key":"opt2","title":"needs-change","rationale":"adjust first"}]}
```

## PASS - Vote thread (opt1)

```text
{"ok":true,"tally":[{"option_key":"opt1","title":"approve","votes":1,"weight":1},{"option_key":"opt2","title":"needs-change","votes":0,"weight":0}]}
```

## PASS - Finalize decision

```text
{"ok":true,"outcome":{"id":"b3e646cc-200d-4179-b0df-dc60c67b2735","thread_id":"8fcb4ac1-b483-4b6a-98f0-bcf90bc4b288","team_id":"321a1f15-a6d6-4ba5-bed4-98f7b7a766c2","title":"10F Transport Check 2026-03-19 09:22:59","decision":"approve","winning_option_key":"opt1","decision_note":"transport check decide","decided_by_email":"extensionpgglobal@gmail.com","decided_at":"2026-03-19T09:23:16.429Z","created_at":"2026-03-19T09:23:16.429Z"}}
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
{"sequence":2,"summary":"10F Transport Check 2026-03-19 09:22:59 -> approve (opt1)","event_id":"87f402a6-c4b4-4dfe-adb0-43096d5e490e","thread_id":"8fcb4ac1-b483-4b6a-98f0-bcf90bc4b288","recovery_cursor_reset_to":null,"recovery_attempted":false,"ack_status":"applied","acked_at":"2026-03-19T09:23:24.467Z","recovery_error":"","recovery_worker_output":""}
```

