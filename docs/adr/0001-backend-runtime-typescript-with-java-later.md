# ADR 0001 — Backend runtime: TypeScript/Next.js now, Java service later if warranted

- Status: Accepted
- Date: 2026-09-30

## Context

orire began as a client-only Next.js (TypeScript) app: the UI, AI orchestration
(`prompt.ts`, `guardrails.ts`, `refinePatch.ts`), plan policy (`plan.ts`), and CV
schema all live in TypeScript. Adding a maintainable backend for accounts,
persistence, entitlements, and billing raised the question of backend language.
Java (Spring Boot) was considered.

## Decision

Build the backend **in TypeScript, inside the existing Next.js app** (route
handlers + server actions), backed by Postgres via Prisma and Auth.js. This is
Phase B0 (already shipped) and the subsequent B1 (server-enforced entitlements)
and B2 (Stripe billing).

We explicitly **keep the door open to add a Java service later** for a bounded,
heavy capability rather than rewriting the web layer.

## Rationale

- **One language, one type source.** Client and server share CV/plan/patch types
  directly — no duplicated contracts across a language boundary.
- **No extra network hop or service to operate.** Server actions and API routes
  run in the same Node process that already proxies AI calls and enforces the
  plan gate.
- **The backend is I/O glue** (auth, CV CRUD, usage counting, webhooks), which
  Node handles well with little ceremony.
- **Velocity and maintainability for an early product**: one repo, one dev
  command, typed DB access via Prisma.

## When to add Java (revisit triggers)

Introduce a **separate Java (Spring Boot) service** for a specific capability —
not a wholesale rewrite — when one or more holds:

1. **CPU-heavy work** emerges: bulk/high-fidelity PDF generation, large-scale
   document parsing, or a compute-intensive JD/CV matching engine where the JVM
   materially outperforms Node.
2. **Enterprise/Teams requirements** call for Spring's ecosystem: SAML/LDAP,
   robust batch jobs, complex transactional workflows.
3. The **team becomes Java-first** and long-term ownership favors it.
4. A **hard service split** (e.g. an isolated billing/identity or matching
   service) is desired for scaling or compliance.

## Intended shape if/when added

- Keep the TypeScript/Next.js app as the **web BFF** (auth, CV sync, UI, Stripe).
- Add a **Java service** exposing a narrow HTTP/gRPC API for the heavy capability
  (e.g. `document-engine` or `matching-engine`).
- Next.js calls it server-side; the browser never talks to it directly.
- Share contracts via an explicit schema (OpenAPI/proto), since the type-sharing
  advantage does not cross the language boundary.

## Consequences

- Near term: fastest path, least to maintain, no premature service boundary.
- The `Entitlement`/`UsageCounter` tables and server-side enforcement (B1) are
  designed so a future Java service could read the same Postgres or call the BFF
  without schema changes.
- Revisit this ADR when a trigger above is hit; supersede rather than edit.
