import { describe, it, expect } from "vitest";
import { parseVerdict, buildJudgePrompt, type JudgeCandidate } from "@/lib/ai/judge";
import { sampleCV } from "@/lib/cv/sample";

const IDS = ["a", "b"];

describe("parseVerdict", () => {
  it("trusts a valid winner among the candidate ids", () => {
    const raw = JSON.stringify({
      scores: [{ id: "a", overall: 70 }, { id: "b", overall: 90 }],
      winner: "a",
      reasoning: "A reads sharper.",
    });
    const v = parseVerdict(raw, IDS);
    expect(v.winner).toBe("a");
    expect(v.reasoning).toBe("A reads sharper.");
  });

  it("falls back to the highest overall when the winner is invalid", () => {
    const raw = JSON.stringify({
      scores: [{ id: "a", overall: 70 }, { id: "b", overall: 90 }],
      winner: "does-not-exist",
    });
    expect(parseVerdict(raw, IDS).winner).toBe("b");
  });

  it("clamps out-of-range and non-numeric scores into 0–100", () => {
    const raw = JSON.stringify({
      scores: [{ id: "a", relevance: 150, impact: -20, coverage: "x", conciseness: 55.6, overall: 200 }],
      winner: "a",
    });
    const s = parseVerdict(raw, IDS).scores.find((x) => x.id === "a")!;
    expect(s.relevance).toBe(100);
    expect(s.impact).toBe(0);
    expect(s.coverage).toBe(0);
    expect(s.conciseness).toBe(56);
    expect(s.overall).toBe(100);
  });

  it("produces a score row for every candidate id even if the model omits one", () => {
    const raw = JSON.stringify({ scores: [{ id: "a", overall: 50 }], winner: "a" });
    const v = parseVerdict(raw, IDS);
    expect(v.scores.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });
});

describe("buildJudgePrompt", () => {
  it("lists the candidate ids and embeds the job description", () => {
    const candidates: JudgeCandidate[] = [
      { id: "a", label: "OpenAI", cv: sampleCV },
      { id: "b", label: "Claude", cv: sampleCV },
    ];
    const p = buildJudgePrompt("Senior role", candidates);
    expect(p).toContain("Senior role");
    expect(p).toContain('id="a"');
    expect(p).toContain('id="b"');
  });
});
