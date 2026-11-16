# OCC 2.0 P7D — Conversation-first UX audit (code-level baseline)

**Scope:** current `main` after #262, #263, #264 (all merged). Related issues: #265 (this audit), #259 (future sensitive history), #241 (independent human factuality reviews).

This is a **code-and-test audit**, not a claim that a person reviewed a complete live browser session. Playwright screenshots must be captured from synthetic signed-in Career fixtures and reviewed separately; no real CVs or chats belong in visual artifacts.

## Findings

| Priority | Finding, evidence | Concrete next action |
|---|---|---|
| P1 | The `section === "analysis"` area in `OccWorkspace.tsx` still renders a large standalone preparation form (CV/JD fields, two upload controls, review button, privacy options, keyword check), despite a second, capable chat composer with document attachments and an explicit Review attached CV action. This remains the main break from a chat-native experience. | In a separate migration PR, move any unique controls into the composer/context actions, expose the keyword-only check as a compact optional assistant card, then remove the duplicated form. Update the M7/M7.1 test contracts together. |
| P1 | `section === "memory"` still inserts a separate `CareerMemory` workspace beneath the timeline; it is not a chronological assistant turn. | Add a compact career-memory assistant card, then move full editing into explicit expandable controls. Make persistence boundaries prominent. |
| P1 | `openConversation` restores text but discards structured review/interview cards, while previous user answers can remain in transcript text. This is currently disclosed but remains a continuity gap. | Do not silently hydrate incomplete cards. #259 P6B needs distinct consent for sensitive CV evidence snippets/interview answers, owner-scoped APIs and deletion cascade. |
| P1 | Right rail's **View / edit** buttons set the paste editor open then synchronously attempt to scroll to an element that has not yet rendered, so the scroll can be ineffective. | Queue a scroll request and perform it after React commits the opened editor; confirm on desktop and mobile. |
| P2 | Current **Jump to latest** button is shown whenever there are more than two turns, whether or not the user is near the bottom, adding persistent clutter. | Only reveal it when the user is away from the bottom, with reduced-motion support and no scroll stealing. |
| P2 | The full CV template preview dialog (rendered through a portal) handles Escape and Tab, but backdrop dismissal doesn't restore focus to the trigger. | Route every close action through one focus-return handler and regression-test Escape, button and backdrop. |
| P2 | Static privacy note suggests that CV/JD leave the device only during review, but upload parsing of PDF/DOCX calls `/api/parse` beforehand. | Clarify *parsing* versus *AI review*. No uploads or saved transcripts occur automatically. |
| P2 | Responsive layout includes 390px tests but 320px is not exercised in a complete career workflow. | Add a 320px synthetic fixture capturing the transcript, composer, CV edit preview and keyboard focus. |

## Working acceptance checklist

- User can choose an agent, attach CV/JD through the **single composer**, and explicitly request review.
- CV review appears at the corresponding assistant turn; claims remain attributed to self-reported evidence.
- Interview questions/answers/feedback appear chronologically; editing a suggested answer never silently asserts an experience.
- Saved version requires explicit field choice, before/after review and approval; original, active CV and template are not mutated by preview.
- Transcript-only save never implies structured result cards are retained after reload.
- Screenshots and E2E cover 1440px, 390px and 320px with synthetic documents and privacy-safe data.
- CI green on exact PR SHA. No beta permission, production configuration or provider budget changes.

## Recommended implementation sequence

1. **P7D.1** (this branch): repair document scroll/focus issues, clarify parsing privacy copy, add 320px and modal tests, capture screenshot evidence.
2. **P7D.2**: de-duplicate CV analysis and move keyword-only check into compact in-thread action; migrate legacy M7 tests to composer-first flow.
3. **P7D.3**: career memory card and better conversation scroll affordance.
4. **P6B #259**: consent-based structured coaching history after the UI contract is stable.

Audit source: `src/components/occ/OccWorkspace.tsx`, `OccCvActionsMessage.tsx`, `OccTemplatePreview.tsx`, `occ2.css`, `e2e/occ.spec.ts`, `src/lib/occ/orchestrator.ts` on current main.
