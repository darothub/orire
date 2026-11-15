# OCC M8 Interview Coaching — Evaluation Protocol v1

**Status:** Benchmark harness implemented; reference examples are **synthetic and NOT yet human-reviewed**. Do not present these as independently validated product quality or clinical/educational/professional advice.

## Goal

Measure whether an interview-coaching suggestion helps people in different lines of work express their *own true experience* in plain language, without adding unsupported achievements or changing the meaning of their answer.

The benchmark is separate from OCC's user-facing feature. No model, database, paid API, CV data or personal information is required to run it. It does not extend production build time.

## Case set

`src/lib/occ/evaluation/fixtures.ts` contains 18 editorially created **synthetic** pairs of candidate answer and suggested rewrite. Fields include an ID, profession, interview question, original answer, proposed rewrite, expected safe outcome and risk type.

Initial coverage: **nursing, teaching, accounting, administration, hospitality, engineering, retail and logistics**. The set includes acceptable unchanged answers and risky statements involving fabricated actions, credentials, metrics, quantities, negation and swapped responsibility.

The synthetic expected classification is an engineering *test oracle*, not proof that two humans judged it accurate. Extend this set using consented, de-identified real-world examples only after appropriate review, and document provenance.

## Two distinct assessment tracks

### A. Deterministic factuality regression (runs in ordinary Vitest CI)

Use:

```bash
npm run eval:occ:interview
```

The benchmark returns: total cases; professions covered; unsafe proposals rejected; safe proposals accepted; false acceptances (fabricated proposal passed); false rejections (valid proposal hidden); and pass/fail by profession.

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
