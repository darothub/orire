# UX93: defer authenticated workspace code

Baseline build: current main `a43a2d3c7309d3d70325f4d746d12d8a5ed98824` (merged PR #188). Anonymous `/` eagerly imported editor, AI and export modules. Browser resource attribution found PDF/Word code in two initial chunks: `01gqsqcny2djb.js` (736,041 decoded bytes; jsPDF, PDF/Word MIME types, export/refine UI) and `31h96apw_po8p.js` (438,528 bytes; Word document engine). Together these explain 1.17 MB of initial parsing work before visitors sign in.

The authenticated UI is moved intact to `WorkspaceApp`, loaded conditionally with `next/dynamic`. SSR remains enabled, preserving server-seeded authenticated rendering. Public landing and authentication stay immediately available. No markup, styling, template, animation, pricing or export behavior is intentionally changed. A regression covers the measured landing byte budget and paid plan intent when the lazy workspace is first revealed; the complete suite covers editor, auth, tour, AI and downloads.

## Repeatable production-build measurements

`measure.mjs` ran five fresh Chromium 153.0.8010.12 contexts per viewport/phase, cold cache, 4× CPU slowdown, 100 ms latency, 500,000 bytes/sec download, 125,000 upload, dark theme, reduced motion, denied analytics and blocked external traffic. Viewports: 1440×900 and 390×844. Each phase served a separate production build at localhost:3100. The app uses system fonts. The after build was measured before committing; `after.json` identifies the base commit and exact changed entrypoint/workspace SHA-256 values, rather than attributing it to unchanged main. Raw resource entries, errors and samples are preserved in `before.json` / `after.json`.

Median values:

| Metric | Desktop before → after | Mobile before → after |
| --- | --- | --- |
| Initial JS transfer bytes | 570,724 → 234,073 | 570,724 → 234,073 |
| Initial JS decoded bytes | 1,885,282 → 756,662 | 1,885,282 → 756,662 |
| LCP | 2,668 → 1,772 ms | 2,604 → 1,760 ms |
| CLS | 0 → 0 | 0 → 0 |
| Script execution (CDP) | 718.9 → 233.8 ms | 702.8 → 208.2 ms |
| Single signup-interaction duration | 272 → 264 ms | 128 → 136 ms |

This removes **59.0% of transferred JS** and **59.9% of decoded JS** from the initial anonymous visit. Lab LCP improves in these samples; this is not a field-performance or universal speed guarantee. Event Timing measures one real signup click (a single-interaction lab responsiveness/INP proxy), not production p75 INP. The mobile interaction sample did not improve. No artificial timing threshold is used to assert a speedup. The browser suite byte guard allows substantial growth above the observed 757 KB while catching reintroduction of the prior 1.89 MB payload.

The first exploratory measurement and axe audit overlapped. Those exploratory metrics were discarded; the recorded baseline was rerun before the optimized build. The first baseline sample overlapped a short lint/type/unit check, so medians and invariant byte counts are emphasized, not precise CPU gains.

Reproduce using the sanitized local verification environment described in `docs/ci-e2e-stabilization.md`: build/start baseline, `PHASE=before node docs/visual-qa/ux93/measure.mjs`; stop it, build/start the changed source, `PHASE=after node docs/visual-qa/ux93/measure.mjs`. Database actions are restricted to disposable local `orire_e2e_*` databases. Measurements themselves are anonymous and never connect to production.

## Actual visual evidence

These are real browser screenshots, not mockups. The before and after PNGs are **byte-identical** at both viewports (SHA-256):

- Desktop: `466a83f29dd5655c823cf06af71435261f759c8430a76320eec2df4346fd9c41`
- Mobile: `3a8101a45e8b9aa390ee1408e5b98f0a196ec86f6b43bf7126cabb6d0a95c8a2`

| BEFORE — actual main render | AFTER — actual optimized render |
| --- | --- |
| ![Desktop before](before-desktop.png) | ![Desktop after](after-desktop.png) |
| ![Mobile before](before-mobile.png) | ![Mobile after](after-mobile.png) |

No visual redesign is proposed or implemented. Real browser page errors: zero across all measured runs. Hero dimensions, typography, CTA and public gallery are unchanged; existing below-fold viewport-triggered rendering remains. The same pixel match does not substitute for the full functional regression.

## Verification

Commands ran through `/tmp/orire-issues-verify.mjs`, which neutralizes personal `.env*` values and targets only disposable `localhost:55488/orire_e2e_ux`. `npm run lint` (one existing warning), `npx next typegen`, `npx tsc --noEmit`, `npm test` (560 tests), and `npm run build` succeeded.

The first full E2E run exposed an SSR/hydration race: the rail was visible before Ctrl+K's listener attached; tour replay failed once and passed on retry. `waitForShell` now waits for the existing template-pill post-mount state, adding no timeout or product markup. Fifteen palette/tour tests then passed with `--repeat-each=3 --retries=0`. The final complete suite passed: **87 passed, 1 unchanged mobile download skip, 51.3 seconds, no retries**. Re-running lint after the exploratory failure also exposed third-party JS in generated trace reports; ESLint now ignores the same generated report directories as Git. No source rule or failing test was disabled. Final lint, type generation, typecheck and all 560 unit tests passed.

No automatic merge or issue closure.
