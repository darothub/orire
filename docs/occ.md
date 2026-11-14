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

## Milestone 4: user-controlled career memory and review decisions

Schema additions: `OccCareerProfile` (one opt-in profile per user) and
`OccAdviceRun` (private, optional saved recommendation sessions). Both
reference User with cascading deletion. Apply the new Prisma migration
before deploying any OCC memory APIs, and regenerate Prisma client.

OCC has Career-only, server-authorized endpoints:
- `GET/PUT/DELETE /api/occ/profile`: view, explicitly save/update, or delete a career profile.
- `GET /api/occ/runs`: retrieve at most 20 recent private saved sessions.
- `DELETE /api/occ/runs/:id`: delete an owned session.
- `PATCH /api/occ/runs/:id/decision`: accept/reject one stored recommendation as a **review decision only**.
- `POST /api/occ/advise` accepts `saveRun: true` to persist the model's
  bounded recommendations; default is not to persist them.

The profile stores user-entered career preferences and notes. Saved runs store
AI summaries, advice, next steps, *and CV evidence excerpts contained in
recommendations*. They do **not** store the complete CV or job description,
but excerpts may still contain personal information. The user can delete the
profile and individual sessions. No application submission, email, export,
or actual CV modification occurs when a recommendation is accepted.

Note: the persisted profile is not yet automatically supplied to model prompts;
the user can continue to enter the goal explicitly in the OCC form. Future work
should add an explicit "use saved profile" setting, dedicated OCC quotas and
full data-export coverage. The existing Orire model routing and AI rate limit
are reused. No production enablement until migrations, lint, TypeScript,
unit, E2E, screenshots and CI checks pass.

## Milestone 5: explicit intelligent context + safe local wording approvals

- `POST /api/occ/advise` accepts `useSavedProfile: true` (default false).
  Only after Career authorization does the backend load that user's saved
  profile; otherwise no profile DB read is needed and no stored preferences or
  notes enter the LLM request. Inline career goal takes precedence. The API
  returns `usedSavedProfile` for transparent user-facing disclosure.
- Saved profile preferences and notes are treated as **unverified user input**,
  not independent proof of qualifications. CV-based evidence checking remains
  authoritative for quoted experience claims.
- The OCC workspace has an opt-in checkbox for each AI analysis, OFF by default.
- Supported quoted evidence can be selected for a **manual, user-authored
  wording replacement** with preview and explicit approval. Approval changes
  an in-browser working copy only. The user can reset to the original or copy
  the draft; the original CV, cloud document and saved history are not altered.
- This is *not* automatic, LLM-authored CV editing or a full document merge.
  No CV persistence, export, application submission or agent-initiated action
  is provided at this milestone.

### Required release gates

The OCC branches remain stacked and unmerged. Before PR/release:
1. Apply Prisma migration in isolated test DB; regenerate client.
2. Run lint, `npx tsc --noEmit`, unit tests, Next production build.
3. Test flag off and anon/Free/Pro denial at every OCC API (including direct URL),
   Career success, cross-user isolation and deleting saved profiles.
4. Test context excluded when unchecked, inclusion when checked, edit preview
   reset/copy, and unchanged original CV after approval.
5. Record real Orire mobile and desktop screenshots and validate browser UX.
6. Confirm GitHub Actions green. Do not enable production flag before sign-off.

Follow-up: persist user-approved edits as a **new** document version with
optimistic concurrency checks and undo, plus agent spend quotas, consent
auditing and evaluation fixtures.
