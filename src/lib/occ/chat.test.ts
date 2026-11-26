import { describe, expect, it } from "vitest";
import { CHAT_HISTORY_TURNS, CHAT_MESSAGE_MAX, parseChatInput, parseChatReply, sanitizeHistory } from "@/lib/occ/chat";

describe("parseChatInput", () => {
  it("accepts a message and trims it", () => {
    expect(parseChatInput({ message: "  hello " })).toEqual({ message: "hello", cv: "", description: "", history: [] });
  });
  it("rejects empty, oversized and non-object bodies", () => {
    expect(parseChatInput({ message: "   " })).toBeNull();
    expect(parseChatInput({ message: "x".repeat(CHAT_MESSAGE_MAX + 1) })).toBeNull();
    expect(parseChatInput(null)).toBeNull();
    expect(parseChatInput([])).toBeNull();
    expect(parseChatInput({ message: "hi", cv: 5 })).toBeNull();
  });
});

describe("sanitizeHistory", () => {
  it("keeps only the last turns and drops malformed ones", () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "OCC" : "you", text: `t${i}` }));
    const out = sanitizeHistory([...turns, { role: "system", text: "x" }, { role: "you", text: " " }, 4]);
    expect(out).toHaveLength(CHAT_HISTORY_TURNS);
    expect(out.at(-1)?.text).toBe("t9");
  });
  it("returns nothing for a non-array", () => {
    expect(sanitizeHistory("nope")).toEqual([]);
  });
});

describe("parseChatReply", () => {
  it("reads a JSON reply with a known intent", () => {
    expect(parseChatReply('{"intent":"review","reply":"Let me check."}')).toEqual({ intent: "review", reply: "Let me check." });
  });
  it("drops an unknown intent", () => {
    expect(parseChatReply('{"intent":"delete-all","reply":"Ok"}')).toEqual({ intent: null, reply: "Ok" });
  });
  it("finds JSON wrapped in prose or a fence", () => {
    expect(parseChatReply('```json\n{"intent":null,"reply":"Hi"}\n```')?.reply).toBe("Hi");
  });
  it("uses plain text as the reply", () => {
    expect(parseChatReply("Add your CV first.")).toEqual({ intent: null, reply: "Add your CV first." });
  });
  it("rejects empty output and JSON without a reply", () => {
    expect(parseChatReply("  ")).toBeNull();
    expect(parseChatReply('{"intent":"review"}')).toBeNull();
    expect(parseChatReply('{"broken":')).toBeNull();
  });
});
