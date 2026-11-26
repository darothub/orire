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
- `/api/occ/interview`: any v4 account, plus `ORIRE_OCC_ENABLED`. Each interview question spends one of the plan's interview questions (`PLAN_METERS.interview`: Free none, Pro 15 a month = 3 five-question sessions, Career unlimited); reviewing an answer is included but needs a plan that has interviews. The daily OCC budget still applies on top.

## Rollout
1. `ORIRE_V4_ENABLED=true` and `ORIRE_V4_BETA_EMAILS=<your email>`: only you.
2. Check every page as Career, Pro and Free test accounts.
3. Remove `ORIRE_V4_BETA_EMAILS`: everyone with a verified email.

## Rollback
Set `ORIRE_V4_ENABLED` to anything but `true`. v4 reads and writes the same data as the current app.

## Classic Orire and the home-page redirect

- A signed-in person who passes the v4 gate (`/api/v4/access`) is sent from `/` to `/app`.
- The "Classic Orire" link in the v4 menu opens `/?classic=1`, which records the choice in the browser (`orire:classic`) and keeps them on the current app.
- Opening any v4 page clears that choice, so going back is one click either way.
- Rollback needs no deploy: set `ORIRE_V4_ENABLED` to anything but `true` and the redirect stops.
- The landing-page buttons are unchanged: they open sign-in, and the redirect takes over once the person is signed in.

## Plan and billing

- `/app/plan` is the v4 page for subscribing, switching, cancelling, resuming and updating the card. It reuses `PlanPanel` and the same server actions as the current app.
- Every "See plans" and upgrade link in v4 points there. `/pricing` stays the public page.
- Stripe still returns to `/?billing=...`. The home page forwards those visits to `/app/plan` with the query, so the result notice shows on the plan page.
