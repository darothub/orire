# OCC M8.1–M8.3 — Evaluation, Coaching Safety and Production Readiness

**Owner decision required before production activation.** M8 engineering is merged, but the independent human evidence in [Issue #241](https://github.com/darothub/orire/issues/241) remains outstanding. Do not change `ORIRE_OCC_ENABLED` as part of this work.

## M8.1 — Human evaluation preparation

- Use `src/lib/occ/evaluation/reviewerPacket.ts` to prepare **blinded synthetic examples** for reviewers. The packet deliberately excludes expected labels and risk classifications, so human reviewers cannot simply repeat the engineering oracle.
- Obtain two genuinely independent reviews per case across 42 cases in 20 occupational families (at least 84 assessments). Prioritize qualified reviewers for medicine, nursing, law, agriculture, construction and other higher-risk work.
- Include the original answer, proposed wording and interview question. Score clarity and recognizability (1–5), fabricated claims (yes/no) and meaning preservation (yes/no).
- Do not record human-like synthetic scores. The canonical `human-reviews.json` remains empty until real responses have been collected and checked.
- A second evaluator should adjudicate disagreements; unresolved factuality issues block release. Avoid PII and obtain permission for any non-synthetic examples.

**Prepared is not completed.** Issue #241 tracks recruitment, reviewer independence, consent, collection and adjudication; that cannot be performed by unit tests.

## M8.2 — Coaching reliability

The rewrite guard now rejects unsupported changes to *who* owns an experience and *how certain* a claim is, in addition to unsupported concepts, quantities, negations and reordered factual terms. For example, `I might contact the supervisor` should not become `I will contact the supervisor`; `I` should not become `we`.

When a model suggestion is rejected, OCC provides a conservative lightly polished version of the original text instead, with clear UI labeling and an explanation that users should only use statements that are true.

**Limit:** The guard is conservative lexical validation, not semantic entailment or professional certification. Test-generated numbers are not a production trust score. Human review must check genuine improvements for usefulness and retained personal voice.

## M8.3 — Release readiness and rollback

`src/lib/occ/evaluation/releaseGate.ts` is a **pure evidence gate**, not a deployment trigger. It fails closed until every required input has been verified and explicitly supplied:

| Gate | Verification evidence |
| --- | --- |
| Branch and main CI green | Commit SHA, workflow links, full Playwright result |
| Human review complete | Two independent reviewers per case, unresolved issues = 0 |
| Real-provider smoke | Authorized non-production interview question and feedback, using synthetic content; verify output validation and latency |
| Kill switch and Career entitlement | Anonymous and lower-tier denied; OCC only available with server-side flag `ORIRE_OCC_ENABLED=true` |
| Privacy and retention | Review policy, input size limits, answer handling, third-party provider processing, logs, consent and deletion |
| Operational rollback | Test disabling the flag and verify OCC endpoint becomes inaccessible without impacting other features |
| Owner approval | Named release owner authorizes limited rollout and monitoring |

### Safe staged rollout procedure (manual, separate change)

1. Keep production OCC flag **off** until all gates are met. Confirm actual environment state with an authorized Vercel administrator; do not infer it from local defaults.
2. Validate an authorized staging/preview deploy with synthetic CV and job role; test both one generated question and one feedback response, plus 403, 400, rate limits and provider error handling.
3. Review provider costs and daily AI budget. Verify no interview answers are written to the database or logged in plaintext by this feature.
4. Confirm the current production deploy and a known-good rollback target. Run a documented flag-off drill in an authorized non-production environment.
5. Obtain explicit owner approval; then conduct a limited Career-user cohort rollout in a separate change and monitor errors and spending.
6. If any unexplained error, fabricated experience, privacy incident or cost spike occurs, disable `ORIRE_OCC_ENABLED` and roll back the deployment if needed. Review logs without exposing candidate answers.

### Pending external evidence

- Two genuine independent assessments per case: **not collected**
- Real AI provider smoke: **not conducted by these deterministic tests**
- Verified production flag state: **not asserted**
- Authorized rollback drill: **not conducted**
- Owner rollout approval: **not given**

These pending items must remain visible; do not mark M8.3 production-ready from passing CI alone.

## Commands

```bash
npm run eval:occ:interview
npm test
npm run lint
npx tsc --noEmit
```

All benchmark runs are offline and use synthetic input. The initial reviewer packet is a typed generator, not a document containing fake filled-out reviews.
