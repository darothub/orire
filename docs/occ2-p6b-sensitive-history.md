# OCC 2.0 P6B — opt-in coaching result history

**Scope**: structured coaching results only. This branch is stacked on P7D (#267); merge P7D first, then retarget/rebase P6B on `main`. It does not enable public access.

## Explicit user consent
Saving an ordinary OCC conversation remains a separate, transcript-only action. The user must **affirmatively check** an explicit consent control and click **Save coaching results** for sensitive structured results to be persisted. No prechecked boxes, automatic saving on provider completion, or background persistence.

Users are told that coaching results include **small quoted CV excerpts**, candidate interview answers, and AI suggestions even though full CV/JD documents are not saved with the snapshot. Existing transcript text may independently include information the user typed. The prior `saveRun` preference is an independent legacy recommendation-run option, not a substitute for snapshot consent.

## Schema and limits
- `OccCoachingSnapshot` records are attached to user-owned `OccConversation` records, using a unique **message sequence** to preserve timeline placement. The record is `schemaVersion:1`, `kind:review|interview`, `payload:Json`, with a consent timestamp. Deleting a conversation cascades to its snapshots.
- Incoming records pass the P6A exact-key, bounded version-1 contract, a batch parser (maximum 40), and server-side validation against an existing **assistant** turn of the correct event type. Unsupported/fabricated CV evidence is not independently verified by the storage schema. No raw provider payload, hidden prompt or full source document fields are accepted.
- Session transcript rewrites **delete previously consented snapshots** inside the same transaction to avoid stale sequence associations. Saving them again requires a **new explicit opt-in**.
- All read/write/delete endpoints require existing private beta access and user-specific conversation ownership. GET responses use `Cache-Control: private, no-store`.
- Opening a saved conversation restores verified version-1 cards in read-only mode. Missing source CV/JD is explicitly disclosed. No background AI call or automatic edit is triggered on restore.

## Retention and removal
No automatic expiry is implemented. Retention continues until the user deletes the structured results, deletes the containing conversation, deletes the account through existing cascades, or a future documented retention policy changes. Snapshot deletion leaves the text transcript intact; deleting the conversation cascades to both. This distinction must remain clear in UI.

## Security and evaluation
- P6B's self-reported CV evidence cannot be considered independently verified. Profession-diverse human evaluation #241 remains mandatory for public launch.
- Test cross-user 404s, 403s, reject non-consent, reject hidden fields/oversize, reject invalid message sequence and type, owner-scoped read/delete, rerender historical cards, 390px mobile screenshots, no accidental CV/JD attachment persistence.
- Do not print or archive real user CVs, interview answers, profile data or credentials in public CI artifacts.

## Deployment
Run the Prisma migration as part of the existing reviewed migration process **before** enabling the P6B UI. Do not merge onto main before P7D #267 and independent CI green. No production database writes are requested from this branch.
