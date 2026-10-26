# PR #188: Playwright fixture and database isolation

## Starting evidence

The starting branch was `ci/central-onboarding-fixture` at `04d546186f66c323f7a7d5dfee46dd4bf336d81e`.
[CI run 40363158384](https://github.com/darothub/orire/actions/runs/40363158384) succeeded, including lint, type generation, typecheck, unit tests and a production build. Its browser job ran **critical smoke only**; full regression was skipped. The path classifier omitted `e2e/`, so that success did not establish full regression coverage.

## Fixture contract

- Import runtime `test` and `expect` from `./fixtures` in every spec. ESLint rejects direct imports of those names from `@playwright/test`; type-only imports remain supported.
- The automatic context fixture seeds `orire-onboarded=1` before navigation, including additional pages and reloads. `showOnboardingTour` is explicitly a **test-scoped** option, defaulting to false.
- First-run tests opt in with `test.use({ showOnboardingTour: true })`. No init script resets their storage on reload, so Skip/completion persistence is still exercised. Manual replay tests use the default fixture and still exercise replay.
- Every test/retry gets a UUID-scoped synthetic database account and JWT. `signIn(page)` uses the identity bound to its browser context; the account stays constant across reloads within the test.
- Teardown closes that context, then deletes only its account (related rows cascade). It never deletes or reseeds another test's identity. Both CI and local runs use two workers.
- Cloud-persistence assertions query the current test's account and run locally as well as in CI. Independent first-CV cases no longer require serial execution.
- Playwright requires an explicit loopback PostgreSQL URL whose database name is `orire_e2e` or starts with `orire_e2e_`. The server and fixtures use the same validated URL, and an existing server is never reused.
- CI uses its disposable `orire_e2e_ci` service database; the shared-user seed script is removed. Any change under `e2e/` selects full regression.

## Spec audit

All 22 existing specs were inspected before edits. All now use shared runtime fixtures; only the shared fixture itself imports the base Playwright runner. `session.ts`, helper signatures and `signup-export.spec.ts` retain type-only Playwright imports.

| Specs | Fixture dependency / onboarding intent |
| --- | --- |
| `accessibility-navigation` | Public `page` plus signed-in `appPage`; migrated the remaining base runner import. |
| `signup-export` | Guest `page`, signed-in `appPage`, mobile `signIn`; removed raw runner and duplicate local onboarding seed. |
| `first-cv-journey` | Guest-to-authenticated `page`, isolated `db`/`e2eUser`; explicitly preserves first-run tour and persisted reload. |
| `onboarding-tour-a11y` | First-run cases explicitly opt in; replay case uses onboarded `appPage`. |
| `smoke` | `appPage`, `signIn`, `stubAI`; only its first-run describe opts in. |
| `conversion-funnel` | Guest/signed-in `page`, consent/analytics interception; removed duplicate onboarding seed. |
| `ux151-studio-actions`, `ux151-studio-before-captures` | Signed-in `page`; removed racing ad hoc tour dismissal. |
| `ai-fact-review`, `command-palette-a11y` | Signed-in `appPage`; default onboarding suppression. |
| `landing-gallery`, `landing-performance`, `landing-regression-contract`, `mobile-landing-ux`, `pricing-visual` | Anonymous `page`; shared setup does not authenticate it. |
| `public-seo`, `public-seo-rendered` | Public `page`/`request`; no external account dependency. |
| `template-guide-redesign`, `ux150-guide-before-captures`, `ux91-export-preview-evidence`, `ux92-a11y-baseline`, `ux97-motion-interaction` | Anonymous browser checks; shared fixture. |
| New: `fixture-isolation` | Parallel independent CVs, JWT subject vs. DB identity, persistence, default suppression across reload and extra context pages. |

## Local verification

Verification uses a newly created PostgreSQL 16 Docker container `orire-pr188-e2e-20261026`, bound only to `127.0.0.1:55488`, with database `orire_e2e_pr188`. No existing development or production database is migrated or reset.

The local `/tmp/orire-pr188-verify.mjs` wrapper blanks keys from checkout `.env*` files before spawning each command. It supplies only the disposable database URL, a synthetic Auth.js secret, `CI=true`, `ORIRE_E2E_BYPASS=1`, `E2E_PREBUILT=1`, password-auth UI enabled, Turnstile disabled and canonical `APP_URL=https://orire.app`. Managed AI, Stripe public key, analytics pixel, external email and Redis credentials are blanked. The canonical URL is metadata; browser requests use localhost:3100.

Commands below were spawned as `node /tmp/orire-pr188-verify.mjs <command>` after `npm ci`:

| Command | Actual local result |
| --- | --- |
| `npm ci` | Exit 0; 526 packages installed; Prisma client generated. npm reported 17 dependency vulnerabilities; dependency upgrades are outside this fixture-only change. |
| `npx prisma migrate deploy` | Exit 0; all 15 migrations applied to the new disposable database. |
| `npm run lint` | Exit 0; no errors, one pre-existing unused `ProviderId` warning in `RunStep.tsx`. |
| `npx next typegen` | Exit 0; route types generated. |
| `npx tsc --noEmit` | Exit 0. |
| `npm test` | Exit 0; 560 tests passed in 80 files. |
| `npm run build` | Exit 0; Next 16.3.7 production build compiled and generated 61 pages. |
| `npm run test:e2e` | Exit 0; 86 passed, 1 pre-existing mobile PDF/DOCX download skip; 52.4 seconds; no retries/flaky tests. |

The existing mobile skip remains unchanged: the desktop download test requires a painted desktop CV preview; separate mobile Export CTA tests executed successfully. No new skip, relaxed assertion, added retry or increased timeout was introduced.

After the browser suite, a read-only query inside this named disposable container reported PostgreSQL 16.13 and **0 User / 0 Document / 0 ExportEvent rows**. All first-run, replay and fixture-isolation cases executed successfully.

Initial local attempts also recorded: restricted `npm ci` could not update Prisma's external cache and was rerun successfully with normal access; a restricted build stalled and was terminated before its successful rerun. An initial unit run used an incorrect local `APP_URL`, causing two sitemap contract failures; the verification environment was corrected to the canonical URL and the complete unit suite rerun successfully. No application SEO code or assertions were changed.

No requested check remains unexecuted locally. GitHub Actions evidence for the final pushed revision is linked in PR #188. The PR remains open for owner review; no issue is closed and no merge is performed.
