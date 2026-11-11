# ADR 0002 — "Tailor to a job": one hub for Simulate, Coach and Refine

- Status: Proposed
- Date: 2026-11-11

## Context

Refine, Coach and Simulate all use AI to move a CV toward a job, but they are
three unrelated rail items today:

- Each can be opened alone, but nothing explains how they relate or what order
  makes sense.
- The job description is already shared through `targetStore.jd`, but each view
  presents it as its own input.
- Refine and Coach both rewrite the CV. Neither knows what the other changed,
  so a later accept can silently overwrite an earlier one.
- Coach is not in `COMPOSABLE_BLOCKS`, so it is missing from Home and the flow.
- Coach elicits real facts from the candidate. Refine cannot reuse them, so the
  user would be asked the same thing twice.

Goal: the three stay usable on their own, can also be run together as a guided
sequence, and never conflict. This is the product's selling point: simulate,
coach and refine a CV for one specific job.

## Decision

Add a **Tailor** hub that sits above the three tools. The tools keep their
views and their standalone use. The hub adds a shared job, a shared fact
ledger, a proposal model, and an optional guided run.

### 1. Roles (one job each)

| Tool | Role | Writes to the CV? |
|------|------|-------------------|
| Simulate | Diagnose: ideal profile, gaps, match score | No. It produces suggestions and a target. |
| Coach | Elicit: targeted questions, real answers | Proposes changes, then adds facts. |
| Refine | Rewrite: tailor wording from grounded facts | Proposes changes only. |

Copy, rail hints and Home cards use these verbs, so users can tell them apart.

### 2. Shared state

- **Job**: `targetStore.jd` stays the single source. The hub edits it once; the
  three views show it read-only with an "edit job" link back to the hub.
- **Fact ledger** (new, `factStore`): grounded facts with provenance
  (`cv` span or `answer`), the job they were given for, and a created time.
  Coach writes answered questions here. Refine and the guard read it. A fact
  is reused across tools and across runs for the same CV.
- **Gap list**: Simulate's gaps are passed to Coach as question seeds so Coach
  does not re-derive them.

### 3. No-conflict rule: proposals, not writes

Every tool returns a **proposal**: a list of changes (the existing `ChangeList`
shape), the CV version it was made from, and its source tool.

- A proposal records `baseHash`, a hash of the CV it was generated from.
- Accepting applies the chosen changes and moves the CV hash forward.
- Other open proposals now have a stale `baseHash`. The hub marks them
  "CV changed since this was made" and offers re-run or re-base. A stale
  proposal is never auto-applied.
- Each accept is one undoable step in version history (`libraryStore`).
- The deterministic fact guard runs on every proposal regardless of tool.

### 4. Entry points

1. **Standalone**: open any tool as today. It reads the shared job and ledger.
2. **Run all** (guided): Simulate → Coach → Refine → Simulate again. Each step
   shows what it will do and can be skipped. The last step re-scores so the
   user sees before and after.
3. **Suggested next**: the hub highlights one step from the state, for example
   no job yet → enter job; no diagnosis → Simulate; gaps with open questions →
   Coach; grounded facts unused → Refine.

### 5. Scoring

The number users see stays the deterministic grader. Model critics are used
for feedback inside a run only. The before/after in Run all uses the same
grader, so the score does not drift between runs.

### 6. Metering

Each tool keeps its own metric (`simulate`, `coach`, `refine`). Run all
consumes each one only when its step runs, and shows the cost up front. A skipped
step costs nothing. If a cap is hit mid-sequence the run stops at that step and
keeps everything already accepted.

## Phasing

1. **Hub and navigation**: Tailor view, shared job input, role copy, add Coach
   to `COMPOSABLE_BLOCKS`, suggested-next logic (pure and tested).
2. **Proposal model**: `baseHash`, stale detection, accept as one undoable
   version step; migrate Refine and Coach onto it.
3. **Fact ledger**: persist Coach answers, feed Refine and the guard, seed
   Coach from Simulate gaps.
4. **Run all**: the guided sequence, before/after score, mid-run cap handling.

Each phase is shippable alone and leaves all three tools working standalone.

## Consequences

- Positive: one clear story, no repeated questions, no silent overwrites, and a
  before/after score that supports the pitch.
- Cost: Refine and Coach need migrating onto the proposal model (phase 2).
- Risk: more surface on Home. Mitigation: the hub is one card; the three tools
  stay reachable from the rail.

## Open questions

- Should the fact ledger persist to the cloud for signed-in users, or stay
  local to the browser at first?
- Should "Run all" be gated to Pro/Career, or only the metered steps inside it?
- Does the hub replace the three rail items, or sit next to them?
