/**
 * orire — health / readiness checks.
 *
 * `runHealthChecks` is pure over its injected dependencies so it can be unit
 * tested without a database or env. The `/api/health` route wires the real
 * deps (Prisma ping, provider-key presence, Stripe config). Semantics:
 *
 *   - DB reachable        → the service is "up" (HTTP 200), even if optional
 *                           integrations are missing.
 *   - DB reachable but no
 *     provider keys / Stripe→ "degraded" (still 200): the app serves, but some
 *                           features are unavailable.
 *   - DB unreachable      → "down" (HTTP 503): fail readiness so load balancers
 *                           and uptime monitors can react.
 */

export interface HealthChecks {
  db: { ok: boolean; latencyMs?: number; error?: string };
  providers: { ok: boolean; configured: string[] };
  stripe: { configured: boolean };
}

export interface HealthResult {
  ok: boolean;
  status: "ok" | "degraded" | "down";
  checks: HealthChecks;
  time: string;
}

export interface HealthDeps {
  /** Resolve with the DB round-trip latency in ms, or reject when unreachable. */
  pingDb: () => Promise<number>;
  /** The provider ids orire currently holds a server key for. */
  providersConfigured: () => string[];
  /** Whether Stripe billing is configured. */
  stripeConfigured: () => boolean;
  now?: () => Date;
}

export async function runHealthChecks(deps: HealthDeps): Promise<HealthResult> {
  const now = deps.now ?? (() => new Date());

  let db: HealthChecks["db"];
  try {
    const latencyMs = await deps.pingDb();
    db = { ok: true, latencyMs };
  } catch (err) {
    db = { ok: false, error: err instanceof Error ? err.message : "Database unreachable." };
  }

  const configured = deps.providersConfigured();
  const providers = { ok: configured.length > 0, configured };
  const stripe = { configured: deps.stripeConfigured() };

  // DB reachability is the only hard gate. Missing optional integrations
  // degrade the status but keep the service "up".
  const status: HealthResult["status"] = !db.ok
    ? "down"
    : providers.ok && stripe.configured
      ? "ok"
      : "degraded";

  return {
    ok: db.ok,
    status,
    checks: { db, providers, stripe },
    time: now().toISOString(),
  };
}
