import { describe, expect, it } from "vitest";
import { CHAT_CV_PROMPT_MAX, CHAT_HISTORY_TURNS, CHAT_MESSAGE_MAX, SHORTENED_NOTE, chatUserPrompt, compactForPrompt, parseChatInput, parseChatReply, sanitizeHistory } from "@/lib/occ/chat";

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

describe("compactForPrompt", () => {
  it("collapses blank space without changing the words", () => {
    expect(compactForPrompt("  Led   a team\t of 5  \n\n\n\n  Shipped   it ", 1000)).toBe("Led a team of 5\n\nShipped it");
  });
  it("cuts at a whole line within the budget and says so", () => {
    const text = Array.from({ length: 50 }, (_, i) => `Bullet number ${i} with some words`).join("\n");
    const out = compactForPrompt(text, 200);
    expect(out.endsWith(SHORTENED_NOTE)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(200 + SHORTENED_NOTE.length + 1);
    expect(out.split("\n").slice(0, -1).every((line) => /^Bullet number \d+ with some words$/.test(line))).toBe(true);
  });
  it("leaves a document under the budget alone", () => {
    expect(compactForPrompt("short", 100)).toBe("short");
  });
});

describe("chatUserPrompt", () => {
  it("sends a shortened CV, not the whole document, and null when there is none", () => {
    const big = Array.from({ length: 2000 }, (_, i) => `Line ${i} of a very long CV`).join("\n");
    const prompt = JSON.parse(chatUserPrompt({ message: "hi", cv: big, description: "", history: [] }));
    expect(prompt.cv.length).toBeLessThan(CHAT_CV_PROMPT_MAX + 100);
    expect(prompt.jobDescription).toBeNull();
    expect(JSON.parse(chatUserPrompt({ message: "hi", cv: "", description: "", history: [] })).cv).toBeNull();
  });
});
