import { describe, expect, it } from "vitest";
import { gateChatReply, type ChatStore } from "@/lib/occ/chatGate";
import type { PlanId } from "@/lib/plan/plan";

function store(plan: PlanId, start = 0) {
  let count = start;
  const s: ChatStore = {
    getPlan: async () => plan,
    consume: async () => ++count,
    refund: async () => void (count = Math.max(0, count - 1)),
  };
  return { s, used: () => count };
}

describe("gateChatReply", () => {
  it("lets Free have 5 replies, then asks to upgrade without keeping the count", async () => {
    const { s, used } = store("free", 4);
    const fifth = await gateChatReply("u", s);
    expect(fifth.ok).toBe(true);
    const sixth = await gateChatReply("u", s);
    expect(sixth).toMatchObject({ ok: false, status: 402 });
    expect(used()).toBe(5);
  });
  it("caps Pro monthly at 30", async () => {
    expect((await gateChatReply("u", store("pro", 29).s)).ok).toBe(true);
    expect((await gateChatReply("u", store("pro", 30).s)).ok).toBe(false);
  });
  it("never caps Career", async () => {
    expect((await gateChatReply("u", store("career", 5000).s)).ok).toBe(true);
  });
  it("gives the reply back when undone", async () => {
    const { s, used } = store("free");
    const gate = await gateChatReply("u", s);
    if (gate.ok) await gate.undo();
    expect(used()).toBe(0);
  });
});
