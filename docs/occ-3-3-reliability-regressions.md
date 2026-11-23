# OCC 3.3.4 — Conversation reliability regression gate

## Existing coverage
- `e2e/occ3-feedback-retry.spec.ts`: interview feedback HTTP 503 → retry, original answer preserved, no duplicate bubble.
- `e2e/occ3-guidance-retry.spec.ts`: Review and Coach HTTP 503 → retry, identical payload, one user turn, responsive error affordance.
- `e2e/occ3-request-isolation.spec.ts`: switching agents or starting a new chat while a request is in flight must discard late results.
- `e2e/occ3-reliability-regressions.spec.ts` **new**: explicit Stop response → retry before a delayed old Review response completes; delayed interview feedback after New chat must not appear.

## Release expectations
Each test uses real UI controls and intercepted network responses; fixtures are synthetic and do not claim AI factual accuracy or human review. The two new tests assert request safety, message ownership, absence of stale results, and successful recovery. Screenshot attachments capture desktop and mobile *stopped-request* visuals.

Run the gated Playwright specs in an environment with `ORIRE_OCC_ENABLED=true`, a working test database/auth setup, and the existing E2E fixture configuration:

```sh
npx playwright test e2e/occ3-feedback-retry.spec.ts e2e/occ3-guidance-retry.spec.ts e2e/occ3-request-isolation.spec.ts e2e/occ3-reliability-regressions.spec.ts
```

Do not count a skipped OCC suite as a passed reliability gate. Lint, TypeScript, unit tests, production build and Playwright must all succeed before merging. Review Playwright screenshot artifacts for layout and mobile overflow.

**Out of scope:** human-review pilot (#291), provider/model factuality, network-level exactly-once execution, persistence across reloads, and performance benchmarks. Stopping a browser request does not guarantee an upstream AI provider or server has stopped processing it. The UI must only ignore superseded responses; it must not claim that the server operation was cancelled.
