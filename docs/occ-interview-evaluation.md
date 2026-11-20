# OCC M8 Interview Coaching — Evaluation Protocol v1

**Status:** Benchmark harness implemented; reference examples are **synthetic and NOT yet human-reviewed**. Do not present these as independently validated product quality or clinical/educational/professional advice.

## Goal

Measure whether an interview-coaching suggestion helps people in different lines of work express their *own true experience* in plain language, without adding unsupported achievements or changing the meaning of their answer.

The benchmark is separate from OCC's user-facing feature. No model, database, paid API, CV data or personal information is required to run it. It does not extend production build time.

## Case set

`src/lib/occ/evaluation/fixtures.ts` contains 42 editorially created **synthetic** pairs of candidate answer and suggested rewrite. Fields include an ID, profession, interview question, original answer, proposed rewrite, expected safe outcome and risk type.

Initial coverage: **20 occupational families**, including nursing, medicine, law, agriculture, construction, manufacturing, social care, transportation, accounting, public service, engineering, teaching, hospitality, retail, logistics, administration, creative work, research, human resources, and environmental services. The set includes acceptable unchanged answers and risky statements involving fabricated actions, credentials, metrics, quantities, negation and swapped responsibility.

### Occupational coverage and risk-tier reporting

`src/lib/occ/evaluation/coverage.ts` declares **20 covered occupational families**, their documented domain-specific claim risks and a review priority (`elevated` or `standard`). This is a **test-prioritization taxonomy only**: it does not classify users, add new product capabilities, or make regulated career advice safe.

Coverage statuses are deliberately distinct:
- `not-sampled`: no synthetic case for a registered family;
- `synthetic-only`: synthetic cases exist, but none has two genuine reviewers;
- `human-partial`: some cases have independent double reviews;
- `human-reviewed`: all cases in that family have at least two independent reviews.

The initial report marks all 20 families **synthetic-only**. It also exposes explicitly unsampled areas such as veterinary medicine, pharmacy, dentistry, aviation, maritime work, mining, architecture and sports coaching. This list is representative, **not an exhaustive occupation catalog**: other unlisted professions must not be assumed to be evaluated.

Clinical authority (medicine and nursing), legal representation, agricultural chemicals, safety sign-offs and employment/financial authority receive **elevated review priority**. Do not overclaim regulated qualifications or procedures. New domains require relevant practitioner assessment, realistic scenarios, and special attention to the risks described in the registry. We do not introduce profession-specific prompting or model inference into this benchmark change.

The synthetic expected classification is an engineering *test oracle*, not proof that two humans judged it accurate. A pair of simple examples per family is **not sufficient empirical coverage** and should not be mistaken for production reliability. Extend this set using consented, de-identified real-world examples only after appropriate review, and document provenance.

## Two distinct assessment tracks

### A. Deterministic factuality regression (runs in ordinary Vitest CI)

Use:

```bash
npm run eval:occ:interview
```

The benchmark returns: total cases; professions covered; unsafe proposals rejected; safe proposals accepted; false acceptances (fabricated proposal passed); false rejections (valid proposal hidden); pass/fail by profession; synthetic-only, higher-priority and not-yet-sampled coverage.

**Mandatory release criterion for the synthetic regression: zero false acceptances**. Also track false rejections to avoid creating a useless system. This criterion covers the known test set only; it is not a universal guarantee. These checks are conservative, not semantic entailment analysis.

No extra LLM calls, builds, browser tests, network requests or background tasks are added.

### B. Independent human assessment (pending actual reviews)

Human reviewers independently read the *original answer*, job context, and the proposed rewrite, without seeing the other reviewer's notes. Use **two distinct reviewers per case**, including a practitioner familiar with the profession where practical.

Each reviewer records:

- **Factual support:** `fabricatedClaim` (boolean). Mark true if the rewrite invents an action, skill, qualification, outcome, employer, procedure, number or responsibility, even if it sounds plausible.
- **Meaning preserved:** `meaningPreserved` (boolean). Mark false when the rephrasing changes actor, negation, certainty, responsibility or degree of accomplishment.
- **Clarity (1–5):** 1 = confusing, 3 = understandable, 5 = concise and easy for an interviewer to follow. Do not reward sophisticated vocabulary.
- **Recognizability (1–5):** 1 = candidate likely would not recognize their own experience, 3 = mostly recognizable, 5 = clearly the candidate's own words and meaning.
- **Notes:** brief evidence for judgments, especially failed items.

Store **real**, de-identified review records in `src/lib/occ/evaluation/human-reviews.json` using fields `caseId`, `reviewerId`, `reviewedAt`, `clarity`, `recognizability`, `meaningPreserved`, `fabricatedClaim`, `notes`. Do not use test stubs or model-generated scores as review data. Avoid including candidate personal information or secrets. Request opt-in before storing any non-synthetic answer.

The summary reports `casesReviewedTwice`, `casesPending`, factuality flags, disagreement case IDs, mean clarity/recognizability and meaning-preservation rate. A case **does not count as reviewed** until two distinct reviewer IDs are present. Resolve disagreements through a documented third-party adjudication; do not hide them or average away a fabricated-claim report.

### Suggested human-release gates

These are **quality objectives**, not measured achievements:
1. 100% of release evaluation cases double-reviewed, with meaningful coverage in each named profession.
2. Zero confirmed invented claims after review/adjudication. Any such finding blocks release.
3. 100% meaning preservation for accepted factual rewrites in the benchmark; differences require investigation.
4. Average clarity and recognizability of at least **4/5**, and investigate any case rated below 3.
5. Track false rejections: a conservative rewrite should remain usable without fabricating details.

Expand the corpus before declaring the quality thresholds representative. Collect at least a few realistic, distinct scenarios per profession, including concise answers, ESL/second-language answers, unusual grammar, negations, role reversal, and CV context that conflicts with the answer. Compare baselines and subsequent versions on the *same held-out fixtures* to detect regressions.

## Limits and responsibilities

- The current parser uses lexical overlap, ordering, numeric checks and negation checks. It can miss subtle semantic fabrication or reject legitimate paraphrases. A human evaluator is necessary.
- The AI's own feedback and any automatic scores are **not** human truth labels.
- A successful CI test alone never establishes that humans would recognize the suggested phrasing as their own.
- Keep OCC's feature flag, rate limiting and explicit user consent. No interview data should enter the permanent dataset without appropriate permission and de-identification.
- When real reviewers submit results, record review date, reviewer role/qualification (without personally identifying details), test-set version and adjudication notes. Preserve the benchmark version and publish aggregate results only.
- Product architect sign-off should review domain balance, review sampling, test leakage, privacy, fairness, provider cost and whether the benchmark realistically represents new users.

## Review workflow

1. Curate proposed fixtures and assign IDs.
2. Verify each synthetic case has the intended technical classification using `npm run eval:occ:interview`.
3. Obtain two independent, genuine human assessments for each case.
4. Enter reviews in `human-reviews.json`; validate with the same command.
5. Adjudicate disagreements, revisit the implementation and expand tests for detected errors.
6. Check factuality, meaning, readability and recognizability release gates *separately*. If review is pending, clearly report it as pending.

**Current human assessment: pending. No human scores have been supplied.**

## OCC 3.2 — Blinded reviewer preparation

The helper at `src/lib/occ/evaluation/reviewQueue.ts` prepares an independently reviewable first batch from the existing synthetic benchmark:

- `getHumanReviewQueue()` lists cases requiring human reviews, sorted with elevated-priority professions first, then the least reviewed.
- `createPriorityReviewPacket(12)` produces a first batch of 12 cases containing only the case ID, profession, interview question, original answer and proposed rewrite.
- `createBlindReviewPacket(caseIds)` creates an explicit case selection. It deliberately omits the engineering oracle (`expected`) and synthetic failure-category label (`risk`) to reduce confirmation bias.

**Reviewer procedure:** Give the same blinded packet separately to two real reviewers. Ask each to assess fabricated claims, meaning preservation, clarity (1–5), recognizability (1–5) and short explanatory notes without consulting the other reviewer. Where feasible, include a qualified practitioner for elevated-risk fields. Store only genuine de-identified `HumanReview` entries in `human-reviews.json`. Use distinct reviewer IDs and record the review date. Do not copy fixture `expected` values into human records.

After each verified submission run `npm run eval:occ:interview`. A case leaves the outstanding queue only after **two distinct** reviews. Any disagreement, fabricated claim or meaning change requires an independent adjudication record and must not be silently classified as safe. Keep adjudication notes and practitioner credentials in an access-controlled review log, without personal data.

**Limitations:** A blinded packet is preparation, not a completed human review. The current empty records file means the result remains **0 independently double-reviewed cases**. Human judgments, practitioner recruiting, privacy review, adjudication and representative domain expansion are still outstanding. No user CV or private chat content is part of these synthetic packets.

## OCC 3.2.2 — Reviewer intake and quality reporting

`src/lib/occ/evaluation/humanQuality.ts` supplies two backend-only, pure functions:

- `validateReviewSubmission(submission, existingReviews)` validates a benchmark case ID, reviewer pseudonym, review date, score range (1–5), binary factuality/meaning assessments, notes, and uniqueness of the reviewer ID for that case. This is **format and duplicate validation only**; a reviewer ID does not prove a person is real or independent.
- `buildHumanQualityReport(reviews)` reports double-review completion, pending cases, average clarity, average recognizability, meaning preservation, flagged fabricated claims, disagreements, and per-profession coverage. Only fully double-reviewed cases contribute quality scores. Empty or single-reviewed data produces `null` scores, not zero or invented quality ratings.

The report status distinguishes `pending-human-review`, `needs-adjudication`, `blocked-by-safety-finding`, and `ready-for-release-review`. A flagged fabricated claim or change in meaning blocks acceptance; conflicting reviews require adjudication. `ready-for-release-review` is **not permission to ship**: it still requires representative samples, documented identity/independence verification, practitioner review and architect sign-off. No scores imply production-level reliability.

### Completing a genuine review

1. The coordinator authenticates each independent reviewer outside the benchmark script, checks relevant expertise, and issues a blinded packet from `createPriorityReviewPacket` or `createBlindReviewPacket`. Keep the other reviewer's response hidden.
2. A reviewer independently examines the original answer and proposed wording and submits a record in the following shape. **This example is a schema illustration only, NOT a review to insert into the dataset**:

```json
{
  "caseId": "CASE_ID_FROM_PACKET",
  "reviewerId": "REVIEWER_PSEUDONYM",
  "reviewedAt": "YYYY-MM-DD",
  "clarity": 4,
  "recognizability": 4,
  "meaningPreserved": true,
  "fabricatedClaim": false,
  "notes": "Evidence-based reason for the rating."
}
```

3. The coordinator validates each actual submission using `validateReviewSubmission`, independently verifies reviewer identities, and appends only verified genuine entries to `src/lib/occ/evaluation/human-reviews.json`. Do **not** paste this template or synthetic test fixtures into that file.
4. Run `npm run eval:occ:interview`. The test output includes the `humanQuality` report, including pending, blocked and contested cases, with profession-specific breakdowns.
5. Record adjudication externally in an access-controlled log when reviewers disagree. Never silently overwrite a judgment or treat a disputed claim as verified. Resolve substantiated safety findings and expand the relevant regression cases before any release decision.

**Current status:** the checked-in `human-reviews.json` remains empty. The human evaluation is not completed. A non-production local test suite uses fabricated **test-only** records to verify reporting logic; those must never be represented as actual reviewers or merged into review evidence.
