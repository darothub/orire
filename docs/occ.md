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

## Milestone 3: grounded advice preview

The Career-only `POST /api/occ/advise` endpoint uses the existing Orire
`agent-analyze` managed-provider route and provider failover. Before a model
call, the deterministic `analyzeEvidence` tool summarizes direct CV/JD
term overlap. Model output is parsed through `parseGroundedAdvice`: evidence
quotes must appear in the submitted CV; otherwise a claimed `supported`
requirement becomes `needs-clarification`. It never modifies the source CV.

Users can choose the non-model comparison or explicitly request AI advice.
Only the latter sends their submitted CV/JD/goal to managed model providers.
No advice, career goal or CV content is persisted by this milestone.
Server-side gating, request-size validation, existing AI rate limiting,
model failover and no-store response headers protect the endpoint.

**Remaining QA before PR / merge:** run `npm run lint`,
`npx tsc --noEmit`, `npm test`, `npm run build`, and authenticated
Free/Pro/Career/flag-off and mobile/desktop Playwright tests. Record genuine
Orire screenshots. Do not enable `ORIRE_OCC_ENABLED` in production or merge
without these checks and green GitHub Actions. Upcoming milestones:
persisted opt-in CareerProfile, spend quotas, conversation/task history,
user-approved CV changes and agent evaluations.
