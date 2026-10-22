# UX #92: keyboard-accessible onboarding tour

Genuine Orire Chromium/Playwright screenshots of the updated
first-run onboarding modal, NOT AI mockups or a visual redesign.

Capture CI: https://github.com/darothub/orire/actions/runs/39736812786
Implementation PR: https://github.com/darothub/orire/pull/109
32 end-to-end tests passed; build, lint, typecheck and unit tests passed.

Screenshots: mobile 390x844 and desktop 1440x900, anonymous fiction
sample data via E2E signed-in session; reduced-motion preference.
Baseline: normal tour design/appearance remains unchanged; this PR
improves focus containment, Tab/Shift+Tab, native button activation,
Escape, and background inert state. Focus outline is visible only
when a tour action button has keyboard focus.

The larger accessibility audit at #92 remains open.
