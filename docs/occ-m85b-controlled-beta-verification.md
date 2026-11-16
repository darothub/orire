# OCC M8.5B — Controlled beta verification checklist

Status: **engineering tests and release instructions only; not an activation approval.** Keep `ORIRE_OCC_ENABLED` unset/false for production until separately authorized.

## Authorization and user-facing navigation

- `/occ`, `/api/occ/access`, and protected `/api/occ/*` routes call `requireOccAccess`.
- Server checks: exact feature kill switch `ORIRE_OCC_ENABLED=true`, authenticated signed session, **session email matching current database account email**, allowlisted address, and active `career` entitlement.
- The `OccEntry` workspace link is hidden until `/api/occ/access` returns `permitted: true`. Unauthorized users cannot open `/occ` directly (404), and protected APIs reject them (403).
- The Playwright fixture exception requires a synthetic E2E identity, explicitly enabled test bypass, and a disposable loopback PostgreSQL database. This cannot authorize a remotely hosted production database.
- The OCC-focused CI suite now verifies **both** allowlisted Career access and rejection of signed tokens whose email disagrees with the database, in addition to Free/Pro denials and non-allowlisted Career accounts.
- CI beta address `occ-beta-ci@orire.test` is deliberately not a production tester. Actual Vercel allowlist is configured separately as sensitive server-side environment data, initially `darotudeen+career@gmail.com`.

## AI limits and privacy

- OCC interview requests gate authorization before parsing or calling a provider. They check request size and validate payload shape; apply provider rate limiting; and reserve an `occ-ai` usage allowance (20 requests per UTC day per user), refunding on provider failure.
- Inspect every OCC AI endpoint for the same patterns, verify prompt-injection protection, response validation, and rejection of cross-account CV access.
- **Never** send actual candidate CVs or interview answers into a third-party smoke-test tool without a user-approved privacy review and explicit consent. Use fabricated test data for initial beta verification.
- Avoid logging raw CVs, job descriptions, interview responses, personal data or provider secrets. Retain only safely minimized operational metadata where useful.
- Verify error response caching is disabled and provider failures are handled without leaking prompts.

## Deployment and production gate

1. Confirm PR CI passes: lint, TypeScript, unit, and OCC E2E; inspect Playwright visual evidence.
2. Confirm the authorized user's actual account has the Career entitlement and expected current database email **using an approved admin workflow** (never output private database records in CI). The existence of an allowlist entry is not proof of a subscription.
3. Verify Vercel production `ORIRE_OCC_BETA_EMAILS` is present; do not expose its value to client-side JavaScript. Do not set `ORIRE_OCC_ENABLED` yet.
4. Obtain explicit owner approval for a controlled internal beta, including privacy/consent, provider smoke, observability and rollback plan. This *beta authorization* is distinct from independent human evidence and public-release approval.
5. After an approved deployment and in a limited session, switch the global flag on, verify the test account sees the entry point and OCC, while a separate non-allowlisted account cannot use the link, page, or API. Recheck exact signed email and entitlement.
6. Make one or two deliberately synthetic interview prompts; verify provider response schema, budget decrement, rate-limit behavior and no personally identifying logs.
7. Demonstrate **rollback** by setting `ORIRE_OCC_ENABLED=false` and deploying/restarting as required for Vercel to pick up the changed environment; confirm requests now return denied and the link disappears. Do not claim instant revocation merely from updating an environment variable; deployed serverless instances may retain prior environment snapshots.
8. Capture results, times, responsible approver, issues and evidence securely. Never mark manual gates as passed without witnessing the checks.

**No production activation or real-provider smoke is performed by the implementation PR.** Issue #241 remains open until real human assessment is completed, independently adjudicated and product/architecture approval recorded. Public launch remains blocked.
