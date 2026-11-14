# OCC Milestones 1–6 — release validation checklist

**Status:** IN PROGRESS — code committed; no verified green CI run, no merge,
no production rollout. Source branch: `feat/occ-versioned-cv`.

## What the repository audit established

- All milestones are stacked in one branch; at the last comparison the branch
  was ahead of `main` and not behind.
- Server-side `ORIRE_OCC_ENABLED=true` and the database Career entitlement
  are both mandatory for OCC entrypoints.
- OCC version creation is a new, inactive, private `Document` with source
  `updatedAt` + exact field checks; original remains unchanged.
- An `OccCvVersion` provenance record enables undo only for unchanged,
  inactive OCC copies. Provenance is cascade-deleted when its CV is deleted.
- New OCC AI calls use Orire's shared rate limiter and a conservative daily
  per-user budget of 20 successful analyses. Failed calls refund the same UTC
  claim period.
- Existing CI runs only for PR/main/dispatch; this branch adds a scoped
  `feat/occ-*` push trigger and a second isolated Playwright run with the flag
  on. No PR is needed to request Actions execution.

## Automated validation (must have evidence before sign-off)

1. `npm ci` (also regenerates Prisma)
2. `npm run lint`
3. `npx next typegen && npx tsc --noEmit`
4. `npm test`
5. Migrate **disposable test Postgres only**:
   `npx prisma migrate deploy`. Verify both OCC migrations apply.
6. `npm run build`
7. Baseline full Playwright with OCC disabled (CI's E2E fixture)
8. `ORIRE_OCC_ENABLED=true npx playwright test e2e/occ.spec.ts --project=chromium`
9. Attach actual browser screenshots/artifacts for desktop and mobile.
10. Verify GitHub Actions and Vercel preview status GREEN.

## Coverage added in e2e/occ.spec.ts

- Flag disabled: private page 404, protected API 403
- Free/Pro subscriptions: private page/API unavailable
- Career plan: full flow available
- Cross-user ownership: cannot version another account's CV
- Stale source: refuses outdated modification (409)
- Save: creates a private, inactive new CV; source data and active pointer stay
  unchanged; source template preserved
- Undo: remove only the OCC-created version
- Narrow-screen layout and screenshots

## Items still requiring follow-up

- Vercel deployment status on an earlier OCC commit was `failure`;
  Vercel build logs are inaccessible until the account authorizes the
  `darothubs-projects` team scope.
- GitHub connector's commit-workflow lookup only includes PR-triggered runs,
  so it cannot confirm the new branch-push CI result. Check the GitHub Actions
  workflow page directly.
- No checked-out Orire repo and no GitHub network resolution in the available
  shell, so lint, Prisma, TypeScript, build and browser tests have NOT been
  executed locally by the assistant.
- Add an idempotency key for repeat OCC version saves before broad public rollout.
- Run explicit authenticated ownership, budget-limit and undo-after-edit
  integration cases in addition to the current E2E suite.
- Confirm the feature remains OFF in production.

## Release rule

**Do not merge or enable the feature** until the two OCC migrations,
all automated tests, actual desktop/mobile visual review, GitHub Actions,
Vercel preview build, and PII/cost protections are verified.
