import { describe, it, expect } from "vitest";
import { parseVerdict, buildJudgePrompt, canonicalCV, judgeCacheKey, type JudgeCandidate } from "@/lib/ai/judge";
import { sampleCV } from "@/lib/cv/sample";
import type { CVData } from "@/lib/cv/schema";

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

/** Deep clone and reassign every `id` field to simulate a re-id pass. */
function reId(cv: CVData): CVData {
  let n = 0;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = k === "id" ? `id-${n++}` : walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(JSON.parse(JSON.stringify(cv))) as CVData;
}

describe("canonicalCV", () => {
  it("strips all id fields so re-id passes compare equal", () => {
    const a = JSON.stringify(canonicalCV(sampleCV));
    const b = JSON.stringify(canonicalCV(reId(sampleCV)));
    expect(a).toBe(b);
    expect(a).not.toContain('"id"');
  });
});

describe("judgeCacheKey", () => {
  const cands = (cv: CVData): JudgeCandidate[] => [
    { id: "a", label: "OpenAI", cv },
    { id: "b", label: "Claude", cv },
  ];

  it("is stable when only volatile ids change", () => {
    const k1 = judgeCacheKey("openai", "gpt", "Senior role", cands(sampleCV));
    const k2 = judgeCacheKey("openai", "gpt", "Senior role", cands(reId(sampleCV)));
    expect(k1).toBe(k2);
  });

  it("changes when the job description changes", () => {
    const k1 = judgeCacheKey("openai", "gpt", "Senior role", cands(sampleCV));
    const k2 = judgeCacheKey("openai", "gpt", "Junior role", cands(sampleCV));
    expect(k1).not.toBe(k2);
  });

  it("changes when the judge provider changes", () => {
    const k1 = judgeCacheKey("openai", "gpt", "Senior role", cands(sampleCV));
    const k2 = judgeCacheKey("anthropic", "gpt", "Senior role", cands(sampleCV));
    expect(k1).not.toBe(k2);
  });

  it("changes when candidate content changes", () => {
    const edited = JSON.parse(JSON.stringify(sampleCV)) as CVData;
    edited.basics.fullName = `${edited.basics.fullName} Jr`;
    const k1 = judgeCacheKey("openai", "gpt", "Senior role", cands(sampleCV));
    const k2 = judgeCacheKey("openai", "gpt", "Senior role", cands(edited));
    expect(k1).not.toBe(k2);
  });
});
