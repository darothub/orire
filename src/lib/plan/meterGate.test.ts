import { describe, expect, it } from "vitest";
import { gateMeter, type MeterStore } from "@/lib/plan/meterGate";
import type { PlanId } from "@/lib/plan/plan";

function store(plan: PlanId, start = 0) {
  let count = start;
  const s: MeterStore = {
    getPlan: async () => plan,
    consume: async () => ++count,
    refund: async () => void (count = Math.max(0, count - 1)),
  };
  return { s, used: () => count };
}

describe("gateMeter", () => {
  it("lets Free have 5 replies, then asks to upgrade without keeping the count", async () => {
    const { s, used } = store("free", 4);
    const fifth = await gateMeter("u", "chat", s);
    expect(fifth.ok).toBe(true);
    const sixth = await gateMeter("u", "chat", s);
    expect(sixth).toMatchObject({ ok: false, status: 402 });
    expect(used()).toBe(5);
  });
  it("caps Pro monthly at 30", async () => {
    expect((await gateMeter("u", "chat", store("pro", 29).s)).ok).toBe(true);
    expect((await gateMeter("u", "chat", store("pro", 30).s)).ok).toBe(false);
  });
  it("never caps Career", async () => {
    expect((await gateMeter("u", "chat", store("career", 5000).s)).ok).toBe(true);
  });
  it("gives the reply back when undone", async () => {
    const { s, used } = store("free");
    const gate = await gateMeter("u", "chat", s);
    if (gate.ok) await gate.undo();
    expect(used()).toBe(0);
  });
  it("keeps Free out of interview practice and gives Pro 15 questions a month", async () => {
    const free = await gateMeter("u", "interview", store("free").s);
    expect(free).toMatchObject({ ok: false, status: 402 });
    expect(free.ok ? "" : free.error).toContain("not included on Free");
    expect((await gateMeter("u", "interview", store("pro", 14).s)).ok).toBe(true);
    expect((await gateMeter("u", "interview", store("pro", 15).s)).ok).toBe(false);
    expect((await gateMeter("u", "interview", store("career", 900).s)).ok).toBe(true);
  });
});
