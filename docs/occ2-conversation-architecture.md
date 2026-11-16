# OCC 2.0 — Conversation-first career workspace architecture (RFC)

Related issues: #248 (umbrella), #249 (conversation UI), #250 (sessions), #251 (documents/template), #252 (safe suggestions), #253 (UX/security).

## Design intent
OCC is the main career conversation interface. Every user action (upload/paste CV, attach job description, review fit, revise CV wording, run mock interview, view a previous recommendation or approve a draft) remains reachable within the **same conversation**. Specialized agents are *roles/tasks* mediated by Orire's backend, not promises of unrestricted provider/model selection. Default: CV Review.

The November 16, 2026 beta screenshots show high-quality grounded recommendations but long stacked cards outside the conversation, separated review/draft workspace, little session context and no visible conversation history or milestones. Keep the substantive advice; move its presentation into compact, progressive chat messages.

## Layout
- **Left rail**: New conversation, search, recent sessions, grouped **virtual service collections**. On mobile, a dismissible labelled drawer.
- **Center**: One ordered, scrollable conversation timeline. Each result is a typed message (text, evidence summary, recommendation cards, clarifying question, editable proposed wording, comparison, interview turn, document event). Composer stays at bottom, has agent selection, upload CV/JD, paste CV/JD, send, and disabled/loading/retry states. Jump-to-latest appears when user scrolls away; new output must not steal focus or scroll position while the user reads earlier content.
- **Right rail**: session document cards with metadata, preview/excerpt/remove/replace; specific milestone links to message IDs (not array indices in persistence), current service/agent; real Orire template selection and CV preview. On mobile, labelled contextual drawer.
- **Body**: light/dark responsive 3-column layout, no overflow; accessible landmarks, focus order, reduced motion, keyboard and screen-reader announcements.

## Data model (next PR, **not yet implemented**)
- `OccConversation`: `id`, `userId`, `title`, `primaryService`, `createdAt`, `updatedAt`, `deletedAt?`, `savePreference`, `schemaVersion`. User-scoped queries only; a single canonical session, no duplicate folders.
- `OccMessage`: `id`, `conversationId`, `sender`, `agentId?`, `type`, `content` (validated bounded JSON), `createdAt`, `sequence`, `status`, optional `parentId`; session-owned and ordered.
- `OccAttachment`: `id`, `conversationId`, `kind` (CV/JD), original label, `sourceDocumentId?`, sanitized extracted text or secure scoped reference, `contentHash`, consent/retention and `createdAt`. Quotas and deletion-cascade; no raw content in analytics or logs.
- `OccMilestone`: `id`, `conversationId`, `messageId`, `kind`, `label`, created timestamp. Resolve anchored navigation across reloads.
- `OccConversationAgent` or derived event metadata: bounded service taxonomy and primary collection; filter session by the primary service or included tags. **Do not create user-manageable physical folders or duplicate one conversation per agent.**

### Retention and consent
The current beta has opt-in `saveRun` for recommendations and otherwise does not promise durable chat history. Before persisting OCC chats, obtain explicit UX/privacy review; clearly state whether history is on, provide opt-out, delete and export, redact PII in telemetry. Encryption/secrecy and no cache on private routes; enforce `requireOccAccess` and database ownership on every read/write; cap input and stored message lengths. Past session data must not silently be sent to AI calls. Deleting a session removes document context and related milestones.

## Agent handling
`OCC_AGENTS` is the selectable implemented-tool registry: Review (default), Interview Coach, CV Improvement, Career Memory. A later dedicated Career Strategy task may be added only after backend functionality/tests. Server decides provider routing and plan entitlement; a user-facing 'model' dropdown only when models are genuinely selectable and auditable. Store agent turns as events in the **same** conversation.

## CV evidence and suggested wording
Review must separate `mentioned-in-candidate-CV`, `not-seen-in-CV`, `candidate-confirmed`, and `independently-verified` (last only if actual external evidence). Never imply 'supported' means true in the world. Ask for missing specifics; proposed text should be grounded in spans of the candidate-supplied CV and may use visible placeholders instead of fabricated claims. Provide a copyable **sample rewrite** with "Verify every detail before using"; only apply after explicit review/approval, version save, and undo. Maintain the existing M8 human benchmark gate (#241).

## Rollout strategy
1. Foundation (this PR): agent taxonomy, basic rails, milestones, text paste and initial mobile tests. Current session is explicitly **not** durable; existing sub-workspaces remain until migrated.
2. P2: secure persistence, privacy agreement, true history + new conversation, genuine category lists; tests before activating storage.
3. P3: document context, real CV template preview, structured attachment actions and version compare.
4. P4: inline analysis/feedback and suggested evidence-grounded rewrites; approval and undo.
5. P5: accessibility/performance tests, responsive polish, actual before/after screenshot evidence, beta usage instrumentation. Keep public launch gated.

## Definition of done
All user tasks complete inside conversation; persisted history correct across devices; automatic category filters never duplicate conversations; CV/JD accepted via upload or full-text paste; contextual rail and milestone links work; template preview uses the actual Orire renderer; review suggestions disclose unverifiable assumptions and require explicit user acceptance; no user data leakage; CI E2E and human-controlled beta checks green. Production stays on explicit allowlist until release decision.
