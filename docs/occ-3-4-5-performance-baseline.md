# OCC 3.4.5 — Conversation performance baseline

## Why
PR #301 isolated the per-second request timer from the main conversation component. We should **measure user-visible responsiveness before attempting complex virtualization or reworking the conversation tree**.

## Repeatable diagnostic
`e2e/occ3-performance-baseline.spec.ts` runs OCC in an authenticated test session with a synthetic CV and a deliberately held Review request. During active processing, it checks composer editability and records input-fill wall-clock duration plus any browser Long Task entries at desktop (1440 px), mobile (390 px) and narrow mobile (320 px). It checks that those viewports do not overflow horizontally, captures screenshot evidence and attaches a JSON report to Playwright artifacts.

Run with the existing authenticated E2E setup and `ORIRE_OCC_ENABLED=true`:

```sh
npx playwright test e2e/occ3-performance-baseline.spec.ts
```

**Interpretation:** The latency numbers include Playwright automation overhead and machine variability; one run cannot establish perceived responsiveness, percentile latency, or a before/after speed-up. Long Task API availability varies by browser. No arbitrary timing pass/fail threshold is used. The test **does** gate functional input editing, cancellation and mobile layout. Compare repeated runs in the **same environment** before setting numerical budgets. The synthetic error response does not call an AI provider.

## Follow-on performance work
If repeated measurements reveal measurable delays, profile React component commits, long-task causes, and DOM size in increasingly long conversations before selecting a fix. Keep all accessible content in the conversation; do not introduce virtualized message lists without explicit focus/navigation tests.

Human review of factual accuracy is separately pending under #291.
