# #151 — approved Studio hierarchy redesign

The owner approved the concrete desktop/mobile, dark/light [screenshot proposal](PROPOSAL.md) in the task chat before implementation. Local production-build screenshots were explicitly accepted for this batch. Earlier Studio entry actions from merged #155/#171 were reviewed and reused; this implements the further approved hierarchy rather than repeating those changes.

## Implemented behavior

- The Studio introduction is concise and shows actual current CV/template context. A fresh workspace says **New CV**; a started document shows its real name, or **Untitled CV** when blank. No saved record, sync status or progress percentage is invented.
- The existing Create/Continue and Library actions remain in a compact next-step panel.
- A named **Your CV tools** section appears immediately afterward. Existing tool order, recommendations, flow toggles and plan checks are preserved.
- Flow guidance and Simulate follow the tools. Guidance refers accurately to the cards above it and works on desktop/mobile navigation.
- Keyboard order follows visual order. Focus uses the existing readable emerald token. Reduced motion removes Studio reveal/hover movement, including pre-hydration styles. Header/rail, editor/live preview, account, subscription and export logic are unchanged.

## BEFORE — actual Orire render

Source main `a86d65c1c267927b1b1b26c529e59e964a061d2e`, local production build `cpjbIOE3tVdzeLOcB00A7`, Chromium 153.0.8010.12. Real fresh fictional account state, denied optional analytics, onboarding seen, reduced motion. Source fingerprints and capture details are in [proposal provenance](proposal-provenance.json). No production records were used.

| Viewport/theme | BEFORE — actual | AFTER — proposed, NOT implemented |
| --- | --- | --- |
| Desktop 1440×900 dark | [Before](BEFORE-actual-for-proposal-studio-desktop-dark.png) | [Approved proposal](AFTER-proposed-NOT-implemented-studio-desktop-dark.png) |
| Desktop 1440×900 light | [Before](BEFORE-actual-for-proposal-studio-desktop-light.png) | [Approved proposal](AFTER-proposed-NOT-implemented-studio-desktop-light.png) |
| Mobile 390×844 dark | [Before](BEFORE-actual-for-proposal-studio-mobile-dark.png) | [Approved proposal](AFTER-proposed-NOT-implemented-studio-mobile-dark.png) |
| Mobile 390×844 light | [Before](BEFORE-actual-for-proposal-studio-mobile-light.png) | [Approved proposal](AFTER-proposed-NOT-implemented-studio-mobile-light.png) |

The proposals are temporary browser DOM/CSS modifications of the corresponding actual page. They are explicitly distinct from actual application source. [Exact proposal CSS](proposal.css.txt) and [full-page proposal links](PROPOSAL.md) make below-fold controls reviewable. The historical initial brief predates shipped work; it is not the current implementation status.

## AFTER — actual browser render

Actual issue-branch screenshots and source/build fingerprints will be added after the verified production build is captured. No deployed-preview inspection is claimed; owner-authorized local evidence is used for this batch.

## Verification

The issue branch runs every required check: `npm run lint`, `npx next typegen`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run test:e2e`. Exact exit/timestamp results will be linked after execution completes.

Ten additional E2E cases cover hierarchy, keyboard order, no horizontal overflow and axe checks at 1440/390/320px in both themes; named/blank real cloud document resume with actual template and retained editor value; relocated flow/coach/Simulate actions; and exhausted free Simulate access still routing to Plans. Existing Studio actions, editor/preview, export, auth and subscription regressions remain in the complete suite. No assertions were loosened, tests disabled or timeouts increased.
