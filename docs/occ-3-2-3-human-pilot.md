# OCC 3.2.3 — Small independent human-review pilot (v1)

**Status:** Prepared, NOT conducted. No human assessments have been received. The full benchmark remains unchanged at 42 synthetic fixtures across 20 occupational families.

## Frozen scope
Use only these **existing** eight cases, two each across four higher-risk occupational families:

| Profession | Case IDs |
| --- | --- |
| Medicine | `medicine-safe-01`, `medicine-risk-01` |
| Law | `law-safe-01`, `law-risk-01` |
| Agriculture | `agriculture-safe-01`, `agriculture-risk-01` |
| Nursing | `nursing-safe-01`, `nursing-risk-01` |

Do not send the ID selection criteria, `fixtures.ts`, technical oracle, or risk labels to reviewers. Generate the actual reviewer-facing records using `createPilotV1Packet()` from `src/lib/occ/evaluation/pilotV1.ts`. Reviewer packet fields: case ID, discipline, interview question, original answer, proposed rewrite. No scoring guidance should disclose the intended synthetic outcome.

This is a narrow **workflow validation**, not statistically representative evidence for medicine, law, agriculture or nursing, and not a certificate of professional or AI safety.

## Reviewer handoff

1. Appoint a coordinator to verify the identities and independence of **two real human reviewers** for each case. Prefer a relevant practitioner where appropriate, and document qualifications separately in an access-controlled log. Reviewers may cover multiple cases, but each case needs two distinct people.
2. Give each reviewer the same blind case, independently. Neither reviewer sees the other's ratings, the synthetic expected verdict, nor any model-generated feedback about whether the rewrite is safe.
3. Ask each reviewer to rate factual fabrication and meaning preservation (yes/no), clarity (1–5), recognizability (1–5), and to supply an explanatory note. Encourage reviewers to mark unknown claims as unsupported rather than make favorable assumptions.
4. The coordinator verifies submissions and reviewer independence, runs `validateReviewSubmission`, and adds only genuine, de-identified records to `src/lib/occ/evaluation/human-reviews.json`. **Do not insert illustrative/test records**.
5. Run `npm run eval:occ:interview` and inspect `getPilotV1Status(actualHumanReviews)`. The pilot requires eight double-reviewed cases and 16 valid submissions. Any disagreement, invented fact, or meaning change stays flagged for follow-up and adjudication.
6. Document adjudication separately, preserving the original ratings. Do not change agent behavior or expand the benchmark before producing a pilot findings report.

## Decision gate before any OCC behavior change

- Report genuine reviewer coverage, including reviewer qualifications and any unreviewed cases.
- Present factual support and meaning-preservation concerns by case, plus clarity and recognizability. Keep machine results and human reviews separate.
- For every confirmed defect, describe the specific input, unsafe output, affected discipline, and a minimal reproducible failing regression test.
- Decide on a targeted fix **only after** the findings are reviewed. No speculative rewording changes or additional fixtures in this phase.
- Do not treat a clean pilot as proof of safety or readiness for general availability. The full benchmark and real-world representativeness require later work.

## Coordinator checklist

- [ ] Two genuine independent reviewers identified per case; eligibility and independence verified
- [ ] Blinded packet distributed without machine labels
- [ ] All 16 genuine review submissions received and validated
- [ ] Disagreements and safety flags adjudicated with audit trail
- [ ] Aggregate pilot findings signed off
- [ ] Confirmed shortcomings converted to regression-first engineering tickets

**At preparation time: 0/16 human submissions, 0/8 cases double-reviewed.**
