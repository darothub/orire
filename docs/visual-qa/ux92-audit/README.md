# UX92: keyboard, thumbnail semantics and contrast audit

Base: current main `a43a2d3c7309d3d70325f4d746d12d8a5ed98824`. Work is independent of performance PR #189.

## Confirmed defects and production fixes

- Password reveal was a real button excluded from sequential keyboard navigation (`tabIndex=-1`). It now participates in Tab order, supports Enter/Space, exposes pressed state and has a visible emerald focus outline. The darker existing accent token keeps the ring readable in light mode.
- Decorative authentication CVs are also `inert`, so contact links in the backdrop never enter modal keyboard navigation. Public CV preview containers now have valid named group/region semantics instead of unsupported labels on anonymous divs. These behavior/semantics changes preserve the visual design.
- All 25 template cards rendered contact links inside an enclosing button. `aria-hidden` hid the thumbnails from assistive technology but did not stop those links receiving focus. Thumbnails are now `inert`, preserving the genuine CV render and keyboard-selectable outer button while removing nested focus targets.
- Small editor labels, template descriptions and AI hints used a faint token with contrast around 3.44–3.68:1 in dark mode. They use the existing readable muted text token.
- The Grade upload button used white on #6366f1 (4.46:1). The approved slightly darker #5d60e8 fill preserves the button hierarchy while passing the audit.
- Light-mode green action text and small status labels had contrast around 3.51–4.06:1. Scoped light-workspace text now uses #08775c. Backgrounds, primary button fills, typography and layout remain unchanged.
- Public landing cards deliberately retain their dark branding in light mode, but descriptions inherited light-theme dark text (about 2.47:1). Descriptions now retain the existing dark-mode readable #9aa29c in both themes.

## Approval and real-screen evidence

The owner explicitly approved the initial dark-theme label/hint/upload-button proposal in this chat, then approved the additional light-theme/action/gallery/password-focus comparison with the message **“approved”** on 26 October 2026. CSS implementation followed the corresponding approval. The scoped status-label shades use that same approved darker emerald correction.

These are real Orire Chromium 153 renders with fictional sample CVs and isolated synthetic accounts. Viewports: 1440×900 and 390×844. Baseline snapshots come from the production baseline/first-pass build; proposal snapshots apply temporary browser-only CSS, not application code. After interruption, temporary additional proposals were reproduced from the preserved first-pass build and archived before rebuilding the added changes. See `provenance.json` for source build details. Random synthetic account labels can differ across captures; no customer data is present.

### BEFORE — actual Orire render / AFTER — proposed mockup

| State | Actual before | Browser-only proposal | Actual implementation |
| --- | --- | --- | --- |
| Dark editor desktop | [Before](before-edit-desktop.png) | [Proposed](proposed-edit-desktop.png) | [Implemented](actual-edit-desktop.png) |
| Dark editor mobile | [Before](before-edit-mobile.png) | [Proposed](proposed-edit-mobile.png) | [Implemented](actual-edit-mobile.png) |
| Dark Grade desktop | [Before](before-grade-desktop.png) | [Proposed](proposed-grade-desktop.png) | [Implemented](actual-grade-desktop.png) |
| Dark Grade mobile | [Before](before-grade-mobile.png) | [Proposed](proposed-grade-mobile.png) | [Implemented](actual-grade-mobile.png) |
| Dark AI settings desktop | [Before](before-settings-desktop.png) | [Proposed](proposed-settings-desktop.png) | [Implemented](actual-settings-desktop.png) |
| Dark AI settings mobile | [Before](before-settings-mobile.png) | [Proposed](proposed-settings-mobile.png) | [Implemented](actual-settings-mobile.png) |
| Light Studio desktop | [Before](before-light-home-desktop.png) | [Proposed](proposed-light-home-desktop.png) | [Implemented](actual-light-home-desktop.png) |
| Light Studio mobile | [Before](before-light-home-mobile.png) | [Proposed](proposed-light-home-mobile.png) | [Implemented](actual-light-home-mobile.png) |
| Light editor desktop | [Before](before-light-edit-desktop.png) | [Proposed](proposed-light-edit-desktop.png) | [Implemented](actual-light-edit-desktop.png) |
| Light editor mobile | [Before](before-light-edit-mobile.png) | [Proposed](proposed-light-edit-mobile.png) | [Implemented](actual-light-edit-mobile.png) |
| Light gallery mobile | [Before](before-light-gallery-mobile.png) | [Proposed](proposed-light-gallery-mobile.png) | [Implemented](actual-light-gallery-mobile.png) |
| Keyboard password focus mobile | [Before](before-password-focus-mobile.png) | [Proposed](proposed-password-focus-mobile.png) | [Implemented](actual-password-focus-mobile.png) |

### AFTER — implemented browser screenshots

Final `actual-*.png` files come from the verified production build on this branch, with no temporary style injection. `actual-capture.json` records browser, source-file SHA-256 values and page errors. These are local production-build screenshots, not a claim of access to an authenticated Vercel preview.

## Automated audit and keyboard validation

`@axe-core/playwright` is pinned at 4.11.0. `e2e/accessibility-audit.spec.ts` runs WCAG 2 A/AA and WCAG 2.1 AA rules with **no rule disabling or node exclusions**. Four combinations cover desktop/mobile and light/dark modes. Per combination:

- Six public routes: landing, templates, Aurora detail, support, forgot-password, and a fictional-token reset form.
- Signup: initial email focus, Tab to reveal, visible focus, Enter/Space reveal/hide, pressed state, Escape dismissal and opener restoration; no real signup or email.
- Five authenticated views: Studio, editor, Grade, export and AI settings. Mobile editor also audits the visible preview tab. Template selection is exercised with focus and Enter.

That is 48 test cases and 50 axe scans, in addition to the existing onboarding, palette, support, keyboard, reduced-motion and CV/export regression. Audit JSONs are attached to browser reports; the durable summary records violations and incomplete checks. Before raw public/workspace findings are included as `before-public.json` / `before-workspace.json`.

The audit waits for actual entrance opacity to settle before measuring colors. Initial exploratory runs exposed further small light-theme labels and an initial-focus timing race; tests gained an explicit initial-email-focus assertion. No timeout was increased and no assertion was removed to achieve green. Shared shell hydration readiness and generated-report lint ignores match the independently verified fixes in PR #189.

## Verification and remaining limitations

All commands use `/private/tmp/orire-issues-verify.mjs` to neutralize personal `.env*` values and point only at disposable loopback `orire_e2e_ux`. Before interruption the audit used disposable PostgreSQL 16.13; Docker was unavailable afterward, so final local verification uses a new PostgreSQL 18.3 cluster. GitHub CI continues to use its isolated PostgreSQL 16 service. No production database is connected, migrated or reset.

Local verification commands all succeeded:

| Command | Result |
| --- | --- |
| `npm run lint` | Exit 0; one pre-existing unused-import warning. |
| `npx next typegen` | Exit 0. |
| `npx tsc --noEmit` | Exit 0. |
| `npm test` | 560 passed in 80 files. |
| `npm run build` | Production build succeeded. |
| `npm run test:e2e` | 134 passed, 1 unchanged mobile download skip, 1.4 minutes; no retries. |

All 48 new accessibility cases executed, producing 50 distinct axe scans (the two mobile preview scans are additional states). Zero violations, zero `aria-prohibited-attr` incomplete items and zero `aria-hidden-focus` incomplete items. Remaining incomplete reports involve non-text symbols and contrast/links over complex backgrounds; see `audit-summary.json`. They are not silently marked passed. Initial exploratory failures and the additional production fixes are described above. Browser captures are checked after opacity/focus settle; final actual screenshots assert the reveal button itself is keyboard-focused.

GitHub CI and protected-preview results are recorded in the PR.

**Known exceptions:** automated axe and browser keyboard checks are not a human screen-reader certification. A person must still exercise VoiceOver/NVDA announcements and reading order; axe `incomplete` items require human review. The audit covers the default fictional CV and named states, not every possible user-authored document, template/content combination or third-party OAuth/captcha/payment UI. These limits keep the broad issue #92 open; this PR uses `Refs #92`, not automatic closure. Owner-authenticated Vercel preview inspection is also required if deployment protection prevents agent access. No automatic merge or issue closure.
