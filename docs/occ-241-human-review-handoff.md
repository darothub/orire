# Issue #241 — Independent human interview-coaching evaluation

## Purpose and current state

The benchmark has 42 **synthetic** examples spanning 20 occupational families. It is not user research and has no human scores yet. This protocol prepares a **blinded evaluation of the exact wording Orire displays** after the interview rewrite safety gate. Do not claim verified user confidence or safety based on the synthetic benchmark alone.

## Critical distinction: two evaluation objects

1. **Candidate-visible coaching text (human assessment)** — the review packet's `suggestedWording` is now derived from `parseInterviewFeedback(...).betterWording`. For an unsafe model proposal, Orire displays a lightly copyedited original answer. Reviewers must evaluate *this actual candidate-visible wording*, not the rejected raw proposal.
2. **Raw model proposal and rejection (machine safety regression)** — `npm run eval:occ:interview` separately checks whether known unsafe proposals were rejected. Raw unsafe proposals, expected labels and risk classifications are never placed in the blinded human packet. Report safety false acceptances/false rejections separately from clarity and recognizability.

Never combine these two populations into one apparently human-validated accuracy score.

## Independent reviewer process

- Recruit a qualified practitioner for high-consequence professional examples (medicine, nursing, law, agriculture, transport and other elevated-risk fields) plus a second independent assessor for each case. Each assessor reads the original answer, interview question, profession and candidate-visible suggestion **without seeing** the other reviewer's judgments, machine expectations or risk labels.
- Each assessor independently records `caseId`, a non-identifying reviewer code, review date, `fabricatedClaim`, `meaningPreserved`, `clarity` 1–5, `recognizability` 1–5 and evidence-based `notes` using the rubric in `docs/occ-interview-evaluation.md`.
- Record reviewer qualifications and assignment provenance **outside the public repository** in access-controlled records, with a verifiable link to the coded reviewer ID. Two different codes are not, by themselves, proof of two independent humans.
- Do not share candidate personal data, raw real-user answers or reviewer identities in GitHub. Contributed realistic examples require specific consent, de-identification and retention rules.
- Reviewers should not penalize simple vocabulary, accented/second-language English, or grammatical differences if the answer stays understandable and true to the candidate's experience.
- Disagreements about invented claims, meaning or appreciable differences in recognizability require independent adjudication, not majority voting that hides a factuality concern.

## Review form for each assigned case

| Field | Reviewer action |
| --- | --- |
| Case ID | Retain provided ID |
| Profession / interview question | Read the supplied context |
| Candidate's original answer | Read as the **only** factual evidence unless additional verified context is deliberately supplied |
| Candidate-visible suggested wording | Score the exact visible output |
| Invented claim? | Yes / No, explain the unsupported claim if Yes |
| Meaning preserved? | Yes / No, explain actor, certainty, responsibility or outcome changes |
| Clarity | 1 (confusing) through 5 (clear); sophistication is not a criterion |
| Recognizability | 1 (not their experience) through 5 (faithful to candidate's own account) |
| Notes | Specific evidence; avoid personal data |

## Acceptance and release boundaries

- First complete 2 real independent reviews per case: **84 assessments**, across **42 cases**, before asserting full double-review coverage.
- Resolve every detected fabricated claim or altered meaning; investigate low clarity/recognizability (<3), aim for averages >=4/5, and report the denominator and source limitations.
- Keep machine false acceptances and false rejections in their own technical report.
- Check the release-readiness guard and obtain provider smoke, explicit consent/privacy verification, rollback demonstration, and product/architecture signoff separately. No human evaluator is authorized to enable OCC.
- `ORIRE_OCC_ENABLED` remains false until separately approved. Do not auto-close Issue #241 or interpret merging an evaluation-tool PR as completion.

## Sampling caveat

Two minimal synthetic examples per field cannot establish real-world correctness. Extend with consented, de-identified, authentic responses from different seniority levels, communication styles and professions before broad reliability claims. The release report should distinguish *synthetic fixture observations*, *independent practitioner judgments*, and *actual user feedback*.
