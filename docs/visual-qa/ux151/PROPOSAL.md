# #151 Studio hierarchy proposal — approval required

Historical proposal record: the owner approved this exact design in the task chat before implementation. See [implementation and actual evidence](README.md) for current status; the screenshots below remain labeled proposals.

**AFTER — proposed mockup, NOT implemented.** Genuine current Orire pages were captured first, then the same page received temporary browser-only DOM/CSS changes for the proposed screenshots. No application source file was edited. No graphical interface was invented.

Source production build: main `a86d65c1c267927b1b1b26c529e59e964a061d2e`, build `cpjbIOE3tVdzeLOcB00A7`; Chromium 153.0.8010.12; http://localhost:3100/. Fresh fictional account/context for each viewport/theme, real **Start your first CV** state. Consent denied, onboarding seen, reduced motion enabled. Accounts and contexts removed after capture. [Proposal provenance](proposal-provenance.json), [browser-only CSS](proposal.css.txt), [earlier current-state audit](README.md).

| Viewport and theme | BEFORE — actual Orire render | AFTER — proposed (same source page) | Below-fold review |
| --- | --- | --- | --- |
| 1440×900, dark | [BEFORE actual](BEFORE-actual-for-proposal-studio-desktop-dark.png) | [AFTER proposed — NOT implemented](AFTER-proposed-NOT-implemented-studio-desktop-dark.png) | [Full proposed page](AFTER-proposed-NOT-implemented-full-studio-desktop-dark.png) |
| 1440×900, light | [BEFORE actual](BEFORE-actual-for-proposal-studio-desktop-light.png) | [AFTER proposed — NOT implemented](AFTER-proposed-NOT-implemented-studio-desktop-light.png) | [Full proposed page](AFTER-proposed-NOT-implemented-full-studio-desktop-light.png) |
| 390×844, dark | [BEFORE actual](BEFORE-actual-for-proposal-studio-mobile-dark.png) | [AFTER proposed — NOT implemented](AFTER-proposed-NOT-implemented-studio-mobile-dark.png) | [Full proposed page](AFTER-proposed-NOT-implemented-full-studio-mobile-dark.png) |
| 390×844, light | [BEFORE actual](BEFORE-actual-for-proposal-studio-mobile-light.png) | [AFTER proposed — NOT implemented](AFTER-proposed-NOT-implemented-studio-mobile-light.png) | [Full proposed page](AFTER-proposed-NOT-implemented-full-studio-mobile-light.png) |

## Exact proposed changes

1. Keep **Your CV studio**, shorten the repeating introduction and show the actual current template (Aurora in this state) plus **New CV**. For a started CV, use existing started/name state; do not fabricate a library item, save status or progress percentage.
2. Compact the existing next-step panel while retaining its primary Create/Continue editing action and secondary Library route. Retain current palette, typefaces and button treatments.
3. Put existing tool cards directly after the next step under **Your CV tools** / **Open a tool or add it to your flow.** This gives mobile users a clearer route to the tools earlier in the page. Existing tool order, recommendation logic, flow toggles and plan checks remain intact.
4. Move existing flow guidance and the truthful Simulate panel below the tools. Both remain available; the first-CV action has visual priority.
5. Scope layout changes to Studio. Header, workspace rail, editor/live CV preview, exports, account and billing logic retain existing behavior. Keyboard order follows the visible order; retain accessible sections and focus treatment. Motion changes belong to #97.

## Approval and validation

Approve this exact hierarchy/template-context/mobile compactness proposal before product UI/CSS edits. The proposed screens show the actual new-account state; implementation also needs returning-CV/name and empty-name states from real existing stores. Verify desktop1440×900, mobile390×844 and320px, dark/light, keyboard navigation, edit/library/tool routing, flow toggles, paid-plan enforcement, accessibility and the full lint/typecheck/unit/build/E2E gate.

Page errors: **0**. These are local proposal artifacts, not deployed screenshots, finished feature evidence or owner design approval. A production implementation would need separate actual-after screenshots and verified matching source/commit provenance.
