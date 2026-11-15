# OCC M8.1–M8.3 — Review handoff and release gates

This branch prepares evaluation and release controls; it does **not** certify or activate the Career Copilot. Keep `ORIRE_OCC_ENABLED` disabled until the owner approves a separate release decision.

## M8.1 Independent review

- `makeBlindInterviewReviewPacket()` emits 42 synthetic scenario cards across 20 occupational families, without expected classification or risk labels. The original candidate answer, interview question and suggested wording are visible.
- Recruit at least two **real independent** reviewers for each scenario, prioritizing relevant professional expertise for medicine, law, nursing, agriculture and safety-sensitive work.
- Do not commit identities, sensitive career information, or real candidate answers without consent/de-identification. Do not populate `human-reviews.json` with automated assessments.
- Capture genuine reviews under the protocol in `docs/occ-interview-evaluation.md`. Adjudicate disagreements with a documented third reviewer.

## M8.2 Quality hardening

- Run `npm run eval:occ:interview` to catch synthetic false acceptances and false rejections. These tests are engineering regression checks, **not semantic proofs** and not a measure of users' confidence.
- Review all fabricated qualifications, role ownership, outcomes, scope of practice, certainty/negation changes and paraphrases that distort meaning.
- Treat any human reviewer finding of invented experience or changed meaning as a release blocker. Follow up on low clarity or recognizability scores.
- Add newly discovered failure cases to a held-out, versioned test set without leaking the expected answers to reviewers.

## M8.3 Release-readiness decision

`assessM8ReleaseReadiness()` is fail-closed by default. It reports independent double-review coverage, pending assessments, synthetic errors, clarity and recognizability thresholds, and blockers. It **does not automatically enable** the feature.

It requires all of the following before it can report `approved: true`:

1. Full double review of every evaluated case, with no outstanding reviewer disagreements or fabricated-claim flags.
2. Meaning preservation confirmed across independent reviews, clarity and recognizability averages at least 4/5, and investigation of low ratings.
3. No synthetic false acceptances and no untriaged false rejections. Every benchmark family must be registered and reviewed.
4. Explicit manual verification of a user-authorized live-provider smoke test, privacy/consent controls, feature-flag rollback/kill switch, reviewer provenance, and product/architecture approval.

**These manual attestations default to false.** No CI job or synthetic fixture may impersonate reviewer provenance or approve a production rollout. A passing branch CI is necessary for merge consideration but is not sufficient to release OCC.

## Current known status

The v1 benchmark has 42 synthetic cases across 20 occupational families and **zero recorded independently double-reviewed cases**. At least 84 genuine assessments are outstanding. Live provider smoke, rollback verification and release approval have not been established by this branch. M8.3 remains **blocked**.

Tracking: [#241](https://github.com/darothub/orire/issues/241). Original M8 mock-interview delivery: [#240](https://github.com/darothub/orire/pull/240).
