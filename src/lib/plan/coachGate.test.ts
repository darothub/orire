import { describe, it, expect, beforeAll } from "vitest";
import { gateCoachCall, type CoachStore } from "./coachGate";
import { COACH_STEPS_PER_RUN } from "./coachToken";
import type { PlanId } from "./plan";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret";
});

function memoryStore(plans: Record<string, PlanId>) {
  const coach = new Map<string, number>();
  const steps = new Map<string, number>();
  const store: CoachStore = {
    getPlan: async (u) => plans[u] ?? "free",
    getUsed: async (u) => coach.get(u) ?? 0,
    consume: async (u) => void coach.set(u, (coach.get(u) ?? 0) + 1),
    refund: async (u) => void coach.set(u, Math.max(0, (coach.get(u) ?? 0) - 1)),
    claimStep: async (u, r) => {
      const n = (steps.get(`${u}:${r}`) ?? 0) + 1;
      if (n > COACH_STEPS_PER_RUN) return false;
      steps.set(`${u}:${r}`, n);
      return true;
    },
    releaseStep: async (u, r) => void steps.set(`${u}:${r}`, Math.max(0, (steps.get(`${u}:${r}`) ?? 0) - 1)),
  };
  return { store, coach, steps };
}

const start = async (store: CoachStore, user: string) => {
  const g = await gateCoachCall(user, "analyze", undefined, store);
  if (!g.ok) throw new Error(g.error);
  return g;
};

describe("gateCoachCall", () => {
  it("blocks Free on every action", async () => {
    const { store } = memoryStore({});
    for (const a of ["analyze", "rewrite", "critique"] as const) {
      expect(await gateCoachCall("u", a, undefined, store)).toMatchObject({ ok: false, status: 402 });
    }
  });

  it("allows 10 Pro runs a month, then 402 with the upgrade copy", async () => {
    const { store, coach } = memoryStore({ u: "pro" });
    for (let i = 0; i < 10; i++) await start(store, "u");
    const g = await gateCoachCall("u", "analyze", undefined, store);
    expect(g).toMatchObject({ ok: false, status: 402 });
    expect((g as { error: string }).error).toMatch(/all 10 coach runs this month/);
    expect(coach.get("u")).toBe(10);
  });

  it("gives Career 40 runs", async () => {
    const { store } = memoryStore({ u: "career" });
    for (let i = 0; i < 40; i++) await start(store, "u");
    expect(await gateCoachCall("u", "analyze", undefined, store)).toMatchObject({ ok: false, status: 402 });
  });

  it("refunds the unit when analyze fails", async () => {
    const { store, coach } = memoryStore({ u: "pro" });
    const g = await start(store, "u");
    await g.undo();
    expect(coach.get("u")).toBe(0);
  });

  it("requires the token for rewrite/critique and binds it to the user", async () => {
    const { store } = memoryStore({ u: "pro", v: "pro" });
    const g = await start(store, "u");
    expect(await gateCoachCall("u", "rewrite", undefined, store)).toMatchObject({ ok: false, status: 403 });
    expect(await gateCoachCall("v", "rewrite", g.runToken, store)).toMatchObject({ ok: false, status: 403 });
    expect(await gateCoachCall("u", "rewrite", g.runToken, store)).toMatchObject({ ok: true });
  });

  it("caps follow-up steps per run, and a released step frees a slot", async () => {
    const { store } = memoryStore({ u: "pro" });
    const { runToken } = await start(store, "u");
    const claimed = [];
    for (let i = 0; i < COACH_STEPS_PER_RUN; i++) {
      const g = await gateCoachCall("u", i % 2 ? "critique" : "rewrite", runToken, store);
      expect(g.ok).toBe(true);
      if (g.ok) claimed.push(g);
    }
    expect(await gateCoachCall("u", "rewrite", runToken, store)).toMatchObject({ ok: false, status: 429 });
    await claimed[0].undo();
    expect(await gateCoachCall("u", "rewrite", runToken, store)).toMatchObject({ ok: true });
  });

  it("does not let one run's budget spill into another", async () => {
    const { store } = memoryStore({ u: "pro" });
    const a = await start(store, "u");
    const b = await start(store, "u");
    for (let i = 0; i < COACH_STEPS_PER_RUN; i++) await gateCoachCall("u", "rewrite", a.runToken, store);
    expect(await gateCoachCall("u", "rewrite", b.runToken, store)).toMatchObject({ ok: true });
  });
});
