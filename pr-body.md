## GitHub issue closure

Refs the Tailor hub work in ADR 0002 (phase 4 of 4). No issue is closed.

> **Stacked on phase 3** (`darothub-tailor-ledger`, which is stacked on phase 2). Retarget to `main` as the earlier PRs merge.

### Acceptance criteria satisfied
- [x] "Run all" guides Diagnose, Coach, Refine from Tailor, with a bar on each tool to continue or skip.
- [x] Pro/Career only; Free users see a plans prompt.
- [x] Cost shown up front; a skipped step uses nothing; a spent monthly allowance stops the run and keeps accepted changes.
- [x] Before and after use the same deterministic keyword scorer.
- [x] Each tool still runs standalone, meters itself and requires approval; Run all never edits the CV.
- [x] Previous related PRs reviewed; builds on phases 2 and 3.

### Verification
- [x] `npx tsc --noEmit`: clean. `npx eslint src e2e`: 0 errors.
- [x] `npx vitest run src`: 646 tests passed.
- [x] `npx playwright test e2e/coach.spec.ts --project=chromium`: 11 passed (2 new).
- [x] `npx playwright test` (full): 180 passed, 4 failed. All are the known `ux151-studio-actions` colour-contrast failures, identical on main.
- [ ] GitHub Actions links: pending CI.
- [x] Screenshots: not attached; the UI is a text card and a slim bar.
- [ ] Visual changes approved: not requested.

### Risk and scope
- Client-only; no schema or API changes. Steps are advanced by the user, not auto-detected.
- No customer data, payment, credential or deployment changes.

**Do not merge automatically. The owner reviews and merges.**
