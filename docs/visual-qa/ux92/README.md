# Issue #92 — real browser accessibility QA screenshots

Screenshots from real Orire localhost render (Chromium / Playwright),
not image-generated or browser-only design approximations.
Browser capture commit: 2679ff326c0e15b490d8a52f5e0b0fb44fa0e095.
Successful CI run: https://github.com/darothub/orire/actions/runs/39726055692
29 E2E tests passed; build, lint, typecheck, unit tests passed.

AFTER-skip-link-focused: only visible to keyboard users after Tab.
The default pointer-first page appearance is intentionally unchanged.
AFTER-screenreader-CV-dialog: dialog visually unchanged; accessible
text equivalent comes from fictional sample CV, hidden visually.

BEFORE — actual Orire homepage baseline prior to this change:
https://github.com/darothub/orire/issues/86#issuecomment-6323212994

Tested at 390x844 mobile and 1440x900 desktop in dark theme.
This is a partial #92 audit; other issues remain open.
