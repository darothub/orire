# Orire Career Copilot (OCC)

OCC is an experimental Career-tier-only feature. Development issue: #236.

## Activation

The server-only environment variable `ORIRE_OCC_ENABLED=true` enables OCC
eligibility checks. The default (missing, false, 1, TRUE) is **disabled**.

Feature flag **and** database-backed Career subscription are both required.
Do not use `NEXT_PUBLIC_` flags for OCC authorization. Call
`requireOccAccess()` in every OCC route handler and server action before
reading career data or invoking an LLM. Do not trust a client-supplied plan.

## Rollout milestones

1. Backend gate and tests (foundation, this branch).
2. Authenticated OCC workspace UI and API endpoint; no dead-end buttons.
3. Grounded CV intelligence + job description matching, using existing provider
   adapters, validation and quota/cost controls. Explicitly identify estimated
   scores and unverifiable achievements.
4. User-approved edits/exports; persistent runs with per-user ownership.
5. Interview coach and job-application tracking as later milestones.

## Safety

Never claim a CV achievement without user evidence. Never submit applications
or send external communications without an explicit user approval. Do not log
raw CV data, résumés, or secrets. Keep the kill switch OFF in production until
tests, visual evidence and GitHub Actions are green.
