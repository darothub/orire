# Orire issue #107 — genuine before / proposed after visuals

Source: Orire's real public guide route running locally in Chromium,
using the actual GitHub Actions-built application.
BEFORE-ACTUAL: unmodified page, no invented content or visual changes.
AFTER-PROPOSED: the same real guide with browser-only injected design.
After images are NOT an implementation and are NOT approved.
Actual template image sources are screenshots of real Orire public
/templates/meridian, /templates/oxford and /templates/vertex pages,
all using fictional sampleCV. No private user data included.

Capture CI: https://github.com/darothub/orire/actions/runs/39740467593
Design-only draft PR: https://github.com/darothub/orire/pull/110
Source screenshot test commit: b809d36ae4af44246711b2c505a3637458bfaa43
34 E2E tests passed, build/lint/typecheck/unit passed.
Viewports: desktop 1440x900, mobile 390x844, narrow 320x720.
Checks: no horizontal document overflow, all CV images loaded and
links lead to their actual public template detail route.

BEFORE and AFTER views have the consent banner dismissed.
This branch is a permanent visual evidence archive. Do not merge it
into main or delete it while GitHub issue #107 links its PNG assets.
