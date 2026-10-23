# CI tiers and performance (#123)

Orire's GitHub Actions pipeline has two required jobs:

1. **Lint · Typecheck · Unit tests**: `npm ci`, ESLint, Next type generation, TypeScript and Vitest.
2. **E2E · Playwright** (runs concurrently with checks): `npm ci`, test Postgres migrations, Chromium installation/launch probe, **one** `next build`, and exactly one Playwright tier.

## Which browser tests run?

| Event / changed files | Selection |
| --- | --- |
| Documentation-only pull request | E2E job completes without browser setup; code checks still run |\n| Ordinary pull request | `npx playwright test --grep '@smoke'` |
| PR changes APIs, auth/payment/e2e infrastructure, AI, templates, DB migrations, dependencies or workflow | Full `npm run test:e2e` |
| Push to `main` | Full suite |
| Manual `workflow_dispatch` | Full suite |
| Git diff cannot be evaluated | Full suite (fail safe) |

Core smoke coverage: public keyboard/CV preview, anonymous first CV, AI suspicious-change review, and PDF/DOCX export. Add `@smoke` only to essential user journeys. Never rely on smoke to substitute for the full suite on high-risk changes.

## Why the build occurs in the browser job

Before #123 a standalone build job ran `npm run build` and Playwright independently executed `npx next build && npx next start`. An artifact from the standalone job could be built with different `NEXT_PUBLIC_*` flags than the hermetic browser environment. Now the browser job builds **once** with explicit E2E-compatible flags, and `E2E_PREBUILT=1` tells Playwright to only execute `next start`. Local runs without that variable continue to build/start as before.

## Reliability and troubleshooting

- Chromium uses the npm-pinned Playwright version, a browser cache and a launch probe. An Ubuntu apt-mirror dependency-install step is intentionally not repeated.
- CI uses 2 workers and 1 retry. If there is evidence of shared fixture/data contention, isolate per worker or temporarily reduce workers; do not add retries to hide deterministic bugs.
- E2E traces/video are retained for failures; GitHub artifact retention is 7 days. Preserve important real-application UX screenshots in the repository or relevant issues.
- For documentation-only PRs (files in `docs/` or Markdown files), the E2E job remains a successful required check but skips npm/Chromium/Next/Playwright steps. For code PRs, path filtering chooses smoke vs. full browser coverage. Any unrecognized risky area must be added to the full-suite patterns.
- No separate smoke stage runs before a full stage: that would execute the same tests twice.
- To run the **full suite** on demand, use Actions → CI → Run workflow against the chosen ref.

## Measuring speed

Compare GitHub Actions **wall clock** run durations, not sum of parallel jobs. Track separately: npm installation, build, Chromium preparation, smoke/full browser runtime, retries and failures. Baseline runs include #39892644643 and #39861804323; measure corresponding post-merge runs before claiming a percentage improvement.

## Docs-only fast-path verification

This documentation-only change is a live check of the optimization from PR #126. Its PR CI should show `Classify documentation-only PR` succeeding and `Install Playwright Chromium browser`, `Build once for browser tests`, and the Playwright test steps **skipped**. The E2E job itself must still succeed so required branch-protection checks remain satisfied. A `main` branch push continues to run the full regression as usual.

The E2E job still provisions its PostgreSQL service before step-level skipping. If that fixed overhead remains meaningful after measurement, consider moving documentation classification into a lightweight prerequisite job in a future change while retaining stable required status checks.
