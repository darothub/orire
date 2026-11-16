# OCC 2.0 P6 — Explicitly saved coaching history (architecture and privacy decision)

Parent issue: #259. This P6A branch defines a bounded result contract only. It makes **no schema, database, production environment or UI changes**.

## Why this is necessary

The current `OccConversation` and `OccMessage` persist explicitly saved chat text. Live CV analysis results and interview coaching feedback sit in component state and disappear on reload. OCC 2.0 P6 aims to allow users to **opt in to saving some coaching results**, but not silently store a user's full CV, job description or original documents.

Important distinction: `cvEvidence` is a verbatim CV excerpt and `interview.answer` is personal text. **Structured result persistence still saves sensitive career data.** The interface must state that explicitly, not imply 'we do not store CVs' means that nothing from the CV is stored.

## P6A (this PR)

- Type-safe allowlisted read-only `review` and `interview` snapshot payloads.
- Validate explicit consent, bounded field lengths, limited recommendation counts and no unknown fields.
- Reject embedded `cv`, `jobDescription`, raw provider messages, prompts or extra data.
- Do **not** infer that `supported` means independently verified. A quoted passage requires user verification.
- No database writes, new endpoints or automatic saving. A schema validator alone does not protect future API endpoints; they must perform authorization, ownership, fresh consent and server-side validation.

## P6B (follow-up PR, not implemented)

- Add optional consent UI **before** saving result snapshots, separate from 'Save transcript'.
- Choose a user-owned, versioned, cascade-deleted result storage model, plus stable message anchors.
- Store only explicit selections, not whole uploaded documents, and validate content serverside.
- Authenticated per-user GET/POST/DELETE with `requireOccAccess`, no-store caching, CSRF protection and quotas. Avoid storing new results for any account without consent.
- Hydrate saved cards as **historical read-only snapshots**, not a live analysis. CV/JD are not attached after reopen; further AI requests require user reattachment and clear action.
- Document retention, delete/export, privacy wording and plan restrictions before merging.
- Add E2E roundtrip, cross-user denial, deletion cascade, refusal without consent, real desktop/mobile screenshots.
- Independently evaluate profession-diverse safety and complete Issue #241 before public launch.

## Rollback and release

No new environment flags or automatic public release. Maintain existing private Career beta allowlist. Never merge while CI is red or without owner review.
