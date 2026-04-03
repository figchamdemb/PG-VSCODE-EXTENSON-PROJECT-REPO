# Narrate Final Pass/Fail Template (One Page)

Use this single page for release sign-off in browser + Slack + VS Code extension.

Date:
Tester:
Build/Commit:
Environment: Local / Tunnel / Extension Host
Backend URL:
Public URL:
Admin Prefix:

---

## 1) Core Health

| Check | Expected | Actual | PASS/FAIL | Notes |
|---|---|---|---|---|
| `GET /health` (local) | `200` + `{ ok: true }` |  |  |  |
| `GET /health` (public) | `200` + `{ ok: true }` |  |  |  |
| `/app` (local) | `200` |  |  |  |
| `/app` (public) | `200` |  |  |  |
| `/integrations/slack/health` (local) | `200` |  |  |  |
| `/integrations/slack/health` (public) | `200` |  |  |  |

## 2) Auth & Account (OTP not required)

| Check | Expected | Actual | PASS/FAIL | Notes |
|---|---|---|---|---|
| Sign in with Google/GitHub in `/app` | success redirect/session |  |  |  |
| Account summary loads | no auth error |  |  |  |
| Billing history loads | `200` |  |  |  |
| Support history loads | `200` |  |  |  |
| Sign out | session cleared |  |  |  |

## 3) Team/Governance

| Check | Expected | Actual | PASS/FAIL | Notes |
|---|---|---|---|---|
| Team status | `200` for team/super admin |  |  |  |
| Governance settings | `200` for supported plans |  |  |  |
| Governance sync pull | returns list/no-error |  |  |  |

## 4) Admin Board

| Check | Expected | Actual | PASS/FAIL | Notes |
|---|---|---|---|---|
| Admin summary | `200` (authorized admin) |  |  |  |
| Admin users | `200` |  |  |  |
| Admin subscriptions | `200` |  |  |  |
| Admin payments | `200` |  |  |  |
| Admin support | `200` |  |  |  |
| Admin governance | `200` |  |  |  |

## 5) Enterprise Routes

| Check | Expected | Actual | PASS/FAIL | Notes |
|---|---|---|---|---|
| `/account/enterprise/offline-pack/info` | `200` (enterprise) or expected deny |  |  |  |
| Admin offline-pack issue/revoke | permission + plan enforcement works |  |  |  |

## 6) Slack End-to-End

| Check | Expected | Actual | PASS/FAIL | Notes |
|---|---|---|---|---|
| `.\pg.ps1 slack-check` | `pass: 12, fail: 0` |  |  |  |
| `/pg help` | command list response |  |  |  |
| `/pg thread` + `/pg vote` + `/pg decide` | decision finalizes |  |  |  |
| Governance worker ack | `applied` |  |  |  |

## 7) VS Code UI Toggles (No Command Palette Needed)

| Check | Expected | Actual | PASS/FAIL | Notes |
|---|---|---|---|---|
| Click `Narrate Reading` status item | mode toggles Dev/Edu |  |  |  |
| Click `Narrate View` status item | Exact/Section toggles |  |  |  |
| Click `Narrate Pane` status item | Split/Full toggles |  |  |  |
| Click `Narrate Source` status item | Code+Meaning/Meaning toggles |  |  |  |
| Click `Narrate Explain` status item | Standard/Beginner/Full Beginner toggles |  |  |  |
| Click `Trust Off/On` status item | trust state toggles |  |  |  |

---

## Release Decision

Overall Result: GO / NO-GO

Blockers:
1.
2.
3.

Follow-ups:
1.
2.
3.
