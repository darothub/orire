# Issue #241 — Run the independent review pilot

The goal is genuine external evaluation of the *candidate-visible* interview rewrite, not a synthetic AI certification.

## 1. Prepare the first blinded packets

From a local Orire checkout with dependencies installed, run:

```bash
OCC_REVIEW_EXPORT_DIR=/tmp/orire-241-review npm exec vitest run src/lib/occ/evaluation/reviewPacketExport.test.ts
```

This generates **four blank CSV score sheets** and one **private local ID map** in the designated directory. Use a fresh, private directory per export; exports fail rather than overwrite existing files:

- `pilot-reviewer-a.csv` and `pilot-reviewer-b.csv`: high-priority medicine, nursing, law and agriculture fixtures.
- `full-reviewer-a.csv` and `full-reviewer-b.csv`: all 42 current synthetic cases.
- `reviewer-id-map.json`: the **private** mapping of opaque IDs such as `R-<UUID>` to original fixture IDs. Never share with reviewers, attach to GitHub, or commit it. Protect the output directory and retain it until both completed packets are reconciled.

Use separate independent assessors for A and B. The suffixes label independent assignments, **not real reviewer identities**. The 9-case pilot covers medicine, nursing, law and agriculture. All reviewer-facing IDs are randomized and deliberately do not contain `-risk-`, `-safe-` or profession names. Keep the mapping protected to reconcile genuine results later. The exported source contains no expected classification, risk type, previous reviewer answers, personal records or fabricated scores. The command defaults to **no file writes** unless `OCC_REVIEW_EXPORT_DIR` is supplied. Output should remain outside the Git repository.

## 2. Recruit and calibrate reviewers

For the pilot, find at least one qualified, independent practitioner per domain and a second distinct independent reviewer. Medical and legal expertise is not interchangeable with generic communication review. Store identity and credentials securely in a *private* assignment record mapped to pseudonymous reviewer IDs; do not commit names or emails to GitHub.

Send reviewers the rubric from `docs/occ-interview-evaluation.md`, plus one separate blank CSV each. Ask each to assess independently. Reviewer scores should reflect factual support, preserved meaning, clarity and candidate recognizability, not accent or polished vocabulary. Do not share oracle labels or each other's responses.

## 3. Collect and adjudicate

Only after actually receiving the independent completed scores, validate the reviewer codes, date, independence and source provenance. Use `reviewer-id-map.json` from the **same export batch** to restore original fixture IDs when collecting results; reject unrecognized or duplicate packet identifiers and never infer IDs from ordering. Transform returned scores into the existing `HumanReview` JSON schema (`caseId`, `reviewerId`, `reviewedAt`, `clarity`, `recognizability`, `meaningPreserved`, `fabricatedClaim`, `notes`), omitting names, qualifications and identifying information.

Check that each case has two **distinct actual people**, not just distinct string IDs. Track all disagreements and invented-claim flags, arrange third-party adjudication and document how concerns were resolved. Never turn blanks into favorable defaults or automatically count unverified scores.

## 4. Expand coverage and report limitations

After the high-priority pilot, complete all 42 cases, requiring at least 84 genuine assessments. A synthetic example per profession cannot establish reliability for entire occupational sectors; obtain specifically consented, de-identified realistic samples before any broad claims about professional coaching accuracy.

Release remains blocked under `assessM8ReleaseReadiness` until human findings, provider smoke, privacy, rollback and product/architecture approval are verified. No public production flag changes. Track remaining work in [Issue #241](https://github.com/darothub/orire/issues/241).

## Suggested invitation for practitioners

> We are independently evaluating the clarity and factual accuracy of an AI-assisted interview-coaching tool across professions. Each example is synthetic; no actual candidate personal information is shared. We ask you to independently compare a short candidate answer and its suggested wording, and indicate whether any experience is invented or meaning changed. Participation is voluntary. Your professional qualifications will be verified privately, and only de-identified assessments will be used in engineering evaluation. This is an assessment of the wording, not the candidate's competence. Please confirm if you are interested before we provide the review materials.

**Status:** M8.4 blinded-ID export submitted for CI validation. Reviewer-facing packets require no public benchmark case identifiers. No professional reviewers have been recruited or evaluated by the Orire engineering workflow yet.
