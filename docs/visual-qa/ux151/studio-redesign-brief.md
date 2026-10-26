# Orire Studio home redesign — historical initial brief

This initial brief predates the shipped #155/#171 Studio entry changes and the further screenshot-based design approved by the owner on 26 October. See [current implementation and evidence](README.md) and [the approved further proposal](PROPOSAL.md). The requirements below are retained as the original planning record, not a statement of current approval or implementation status.

## Existing application constraints verified
The authenticated route is handled by `src/app/page.tsx` and its workspace switcher. It composes `SpotlightView` for the default home workspace, `WorkspaceRail` navigation, CV editor, rebrand/refine tools, plan/account controls, live preview and onboarding. Paid-plan choice must survive OAuth return (merged #146). A redesign must preserve those contracts, existing keyboard behavior and the functional editor.

## Proposed design direction
Bring Studio into the current Orire design language (graphite/emerald palette, purposeful type hierarchy, restrained motion, real CV imagery) without turning it into a generic analytics dashboard.

1. **Orientation:** prominent Studio title, current CV/template context and one clear next action (continue editing), without competing hero CTAs.
2. **Resume work:** explicit recent/current CV card drawn from existing document state; never invent saved records or claim auto-sync unless confirmed.
3. **Creation pathways:** compact accessible routes for creating/rebranding, editing, tailoring and exporting a CV, each linked to existing functional actions.
4. **Preview:** retain genuine live editable CV preview; do not replace it with static mockup.
5. **Mobile:** prioritize the next action and recent work; keep navigation and edit/preview switching reachable at 390×844 and 320×720.
6. **Accessibility:** keyboard order, focus return, accessible names, sensible headings, reduced-motion support, no essential information conveyed by animation.

## Required visual gate
- Launch a hermetic E2E authenticated Orire build using fictional CV data. Capture **BEFORE — actual Studio** at desktop 1440×900 and mobile 390×844, recording commit, browser, theme, URL, session setup.
- Build **AFTER — proposed** by editing those authentic screenshots. Preserve existing branding; label as proposal, not an actual render.
- Attach both pairs to issue #151 and obtain explicit design approval. If a real render cannot be captured, mark visual QA blocked rather than producing fabricated evidence.
- After approval implement on a separate focused feature branch; capture **AFTER — implemented** from PR build, perform Playwright keyboard and journey verification plus lint/build/typecheck.
- The completion PR uses `Fixes #151` only after all approved changes pass and evidence is attached; do not merge without owner action.

## Safe delivery slices after approval
- Update the actual Studio/Spotlight content hierarchy and entry points without changing view-store or auth semantics.
- Refine layout and responsive styles for the changed surface only.
- Add tests covering mobile action reachability, keyboard navigation, preview and plan-intent integrity.
