# v4 release switches

v4 is hidden by default. Server-side environment only; never `NEXT_PUBLIC_`.

| Variable | Effect |
|---|---|
| `ORIRE_V4_ENABLED=true` | Turns v4 on for any account with a verified email. Anything else keeps v4 off. |
| `ORIRE_V4_BETA_EMAILS` | Optional, comma-separated exact emails. When set, only these accounts get v4. Unset or empty means everyone (the full rollout). |
| `ORIRE_OCC_ENABLED=true` | Also required for the AI Copilot parts (chat, review, match, interview, saved chats). This remains the owner decision described in `occ-m8-release-readiness.md` (issue #241). |

Accounts that already pass the OCC beta (`ORIRE_OCC_BETA_EMAILS`, Career) keep their access whatever the v4 switch says.

## Who can call what
- v4 pages, `/api/occ/versions`, `/api/occ/applications`: any v4 account (`requireV4User`).
- `/api/occ/chat`: any v4 account, plus `ORIRE_OCC_ENABLED`. Reply allowance by plan (`PLAN_METERS.chat`).
- `/api/occ/advise`, `/api/occ/match`, `/api/occ/conversations`: Career v4 accounts, plus `ORIRE_OCC_ENABLED` (`requireV4Career`). The OCC beta email list no longer applies to these for v4.
- `/api/occ/interview`: unchanged here (OCC access); plan rules follow in a separate change.

## Rollout
1. `ORIRE_V4_ENABLED=true` and `ORIRE_V4_BETA_EMAILS=<your email>`: only you.
2. Check every page as Career, Pro and Free test accounts.
3. Remove `ORIRE_V4_BETA_EMAILS`: everyone with a verified email.

## Rollback
Set `ORIRE_V4_ENABLED` to anything but `true`. v4 reads and writes the same data as the current app.
