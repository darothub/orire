# Manual signup → export QA

Hermetic automation: `e2e/signup-export.spec.ts` (no real DB/SMTP).  
Use this checklist when you have **Postgres + mail** (local Mailpit or real inbox).

## Prerequisites

- App running (`PORT=3001 npm run dev` or preview)
- `DATABASE_URL` reachable; migrations applied
- SMTP/Mailpit so verification mail is deliverable
- `NEXT_PUBLIC_PASSWORD_AUTH=true` if testing email/password signup
- Private/cold browser (or clear site data) for cross-account checks

## Desktop

1. Cold browser → landing → **Get started free** → Create account (email + password ≥ 8).
2. Submit → account created; verification email arrives.
3. **Before verify:** browse OK; Export download / upload / AI blocked with verify copy.
4. Open verify link → banner clears / status verified.
5. Edit a field → live `#cv-paper` updates.
6. Export → Download PDF, Word (.docx), `.txt`, Copy plain text.
7. Free plan: after download cap, upgrade messaging (if testing Free).
8. Sign out → guest cannot download.

## Mobile (≈390px or device)

1. Same signup → verify.
2. Switch pane **Edit** / **Preview** as needed; Export CTAs reachable.
3. PDF + Word downloads work.

## Cross-account

1. Account A: build CV, export once.
2. Sign out → Account B signup → empty CV / no A data or rail order bleed.

## Pass criteria

- No console errors on happy path
- Unverified = browse-only (server + UX)
- PDF/DOCX/TXT files download
- No cross-account storage bleed

## Related code

- Server gate: `src/lib/auth/guard.ts` (`requireVerifiedUser` / `requireVerifiedAction`)
- Export: `authorizeExport` in `src/app/actions/activity.ts`
- Hermetic E2E bypass (never in prod): `ORIRE_E2E_BYPASS` + `src/lib/e2e/bypass.ts`
