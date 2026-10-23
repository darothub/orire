# Repeatable anonymous and responsive UX regression coverage (#96)

This is a test-only completion of the regression-coverage issue. It changes no application markup, copy, CSS, layout, authentication, billing, or account records. The new tests fill previously missing section-link and persisted-theme coverage; existing regression tests remain the authority for the other criteria rather than duplicating them.

## Acceptance map

| Criterion | Executable coverage |
| --- | --- |
| Landing H1 | `public-seo.spec.ts`: homepage has exactly one accessible H1; `mobile-landing-ux.spec.ts`: exact hero headline renders at 320, 390, 768 and 1440px |
| CTA and signup intent | `first-cv-journey.spec.ts`: actual hero CTA opens signup on desktop/mobile, validates form constraints and supports a fictional first-CV journey; paid plan opens signup without checkout. `signup-export.spec.ts`: signup intent and failure handling |
| All navigation anchors | New `landing-regression-contract.spec.ts`: all four named desktop/mobile links have the correct hash and reach one actual visible destination; each mobile navigation closes the menu |
| Template gallery | `landing-gallery.spec.ts`: real fictional CV templates, valid nonnested navigation anchors, no hydration warnings, preserved alignment and actual detail page |
| Live demo | `mobile-landing-ux.spec.ts`: fitted centered paper, template selection, enlargement and Escape across four breakpoints; `accessibility-navigation.spec.ts`: announcements, text equivalent and modal keyboard behavior |
| Pricing | `pricing-visual.spec.ts`: desktop card alignment, padding and CTA geometry; `first-cv-journey.spec.ts`: unauthenticated paid-plan CTA starts signup without initiating Stripe |
| Mobile menu | `mobile-landing-ux.spec.ts`: 44px controls, expanded state, Escape/focus return, outside click and navigation; new tests additionally exercise every destination at 390px |
| Focus states | `accessibility-navigation.spec.ts`: visible focused skip link, main focus, preview containment/restoration, including 320px. `command-palette-a11y.spec.ts` and `onboarding-tour-a11y.spec.ts`: signed-in modal keyboard contracts. New theme test activates its focused button with Enter |
| Theme | New `landing-regression-contract.spec.ts`: dark→light keyboard switch changes the theme control's computed background/text/border colors and actual rendered header; stored preference, colors and theme-control appearance survive reload |
| Reduced motion | `mobile-landing-ux.spec.ts`: mobile-menu CSS transitions disabled when the preference requests reduced motion; all new captures explicitly request reduced motion |
| Stable screenshot baselines | New theme test compares a light theme-control baseline with the same control after reload, in the same browser, and proves it differs from the dark control. Both baseline and actual are attached; full actual viewport captures document each theme |
| Safe fixtures | Anonymous new tests never submit signup, install session cookies, call account actions, or initiate checkout. Existing authenticated tests use the established fictional JWT/AI/signup stubs; no real Stripe or provider keys are needed |
| CI artifacts and failure reporting | Existing `.github/workflows/ci.yml` reports smoke/full selection, uploads both HTML report and `test-results/**` even after failures (unless cancelled), keeps artifacts seven days, and uses traces on retry plus failure videos. New cases carry `@smoke`, so ordinary code PRs run them; high-risk PRs/main also run the full suite |

## Deterministic capture conditions

New tests use fresh anonymous contexts; exact desktop 1440×900 or mobile 390×844 viewports; dark initial color scheme; `en-GB` locale; UTC timezone; reduced-motion preference; declined optional analytics consent; and no external account or personal CV data. They wait for `document.fonts.ready` and settled hero transforms, disable screenshot CSS animations, hide the caret and capture CSS pixels. The theme preference is seeded only when absent, so reload tests cannot accidentally reset the saved choice. The theme control is focused consistently for screenshot comparison before and after reload.

The screenshot assertion deliberately uses a **same-browser reload baseline**, not an unreviewed cross-platform pixel golden. A Debian/system-Chromium image is not an authoritative Ubuntu/pinned-CI screenshot. The landing intentionally keeps its dark branding in both app themes; computed background/text/border colors on the theme-aware toggle must change and persist, so changing only its icon cannot pass the theme test. Existing layout/interaction checks guard cross-commit regressions in placement and behavior, while the control images guard theme rendering/persistence. An initial full-header byte-equality attempt detected only 15 of 99,600 pixels changing, with maximum 7/255 channel difference, at unrelated rounded Sign in/Get started corners; actual theme-control pixels and computed colors were identical. Rather than increase a comparison tolerance, the assertion targets the genuinely stable theme surface. Full header images remain attached for review. Larger full-page pixel goldens would be unstable due to platform fonts, animated below-fold content and browser rasterization; review attached real captures rather than approving platform drift automatically.

Run the focused tests using the repository's pinned browser:

```bash
npm ci
npx playwright install chromium
npm run build
E2E_PREBUILT=1 npx playwright test e2e/landing-regression-contract.spec.ts --project=chromium --workers=2
```

For consistent signup UI in the full suite, build with `NEXT_PUBLIC_PASSWORD_AUTH=true` as CI does. A disposable migrated PostgreSQL database is needed by existing authenticated server actions in the full suite, even though the fictional JWT avoids external authentication. Set `DATABASE_URL` and `DIRECT_URL` to that disposable database; never point tests at production or developer account data.

To run the full regression, use `E2E_PREBUILT=1 npm run test:e2e` after the production build. Inspect the runner's exit status and actual executed/skipped counts, then inspect HTML report attachments; do not infer passing tests from screenshots alone.

## Actual screenshot evidence

Captures below show existing UI **before and after a theme-toggle action**, not a new product design or a claim that test code redesigned the site. There is no proposed visual change requiring a mockup approval. All images are generated by real Playwright-controlled Orire pages and are attached to their current test results.

Captured 23 October 2026 with Chromium 154.0.8037.57 on Debian. Capture source: test branch `test/ux96-responsive-regression`; application source is unchanged `main` commit `48fa224703aaf6e219fd01f2e3218b81b5518baf` served from the shared baseline build, plus only the browser tests in this PR. Shared unchanged-main production local test server on port 3493; desktop 1440×900 and mobile 390×844; dark-before/light-after; fictional public example CVs. Local ports identify evidence provenance and are not user-facing preview links. A deployed PR preview is not asserted as independently inspected.

| Viewport | BEFORE — actual dark UI | AFTER — actual light UI |
| --- | --- | --- |
| Desktop | [Before theme toggle](BEFORE-theme-toggle-desktop-1440.png) | [After theme toggle](AFTER-theme-toggle-desktop-1440.png) |
| Mobile | [Before theme toggle](BEFORE-theme-toggle-mobile-390.png) | [After theme toggle](AFTER-theme-toggle-mobile-390.png) |

Local validation outcomes and browser differences are recorded below after the actual run. Pinned CI remains the final cross-platform check before merge. This closes the scoped regression-coverage requirements when reviewed/merged; it does not claim WCAG certification or external authentication/provider/payment integration testing.

## Validation record

- ESLint passed with the existing unused `ProviderId` warning; Next type generation/TypeScript and all 542 unit tests passed.
- New focused browser checks: **4 passed**, system Chromium154 with video recording disabled in a temporary local config because bundled ffmpeg is absent; tracked CI configuration is unchanged.
- A broader local run recorded failures in existing AI fact-review and first-CV scenarios (including a tour intercepting cookie dismissal and a persistence/session timeout). These are not ignored or converted to passes. The restored shared-server run is not claimed as a successful full regression; pinned-browser CI must execute the complete suite before review.
- No UI code changes were made. Screenshot evidence was captured and inspected from the real unchanged production application, rather than generated as an implemented-after image.
