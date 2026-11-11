import { buildPatchPrompt } from "@/lib/ai/prompt";
import { sampleCV } from "@/lib/cv/sample";
import { describe, it, expect } from "vitest";
import { acceptTypedFigures, sanitizePromptFacts, factForArea, factId, factLines, liveFacts, mergeFacts, MAX_FACTS, recordAnswers, removeFact, sanitizeFacts } from "./facts";

const a = { area: "Measured impact", question: "By how much did engagement lift?", answer: "34% weekly active use" };

describe("recordAnswers", () => {
  it("adds a fact and ignores blank answers", () => {
    const f = recordAnswers([], [a, { ...a, question: "Other?", answer: "   " }], "Acme PM", 100);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ id: factId(a.area, a.question), answer: a.answer, job: "Acme PM", createdAt: 100, updatedAt: 100 });
  });

  it("updates in place when the same question is answered again", () => {
    const first = recordAnswers([], [a], "Acme", 100);
    const next = recordAnswers(first, [{ ...a, answer: "36% weekly active use" }], "Beta", 200);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ answer: "36% weekly active use", createdAt: 100, updatedAt: 200, job: "Beta" });
  });

  it("leaves the ledger untouched when the answer did not change", () => {
    const first = recordAnswers([], [a], "Acme", 100);
    expect(recordAnswers(first, [a], "Acme", 999)[0].updatedAt).toBe(100);
  });
});

describe("removeFact and mergeFacts", () => {
  it("a delete survives merging with an older copy from another device", () => {
    const local = recordAnswers([], [a], "Acme", 100);
    const deleted = removeFact(local, factId(a.area, a.question), 200);
    const merged = mergeFacts(deleted, local);
    expect(liveFacts(merged)).toHaveLength(0);
  });

  it("the newer record wins and distinct facts are unioned", () => {
    const x = recordAnswers([], [a], "Acme", 100);
    const y = recordAnswers([], [a, { area: "Scale", question: "How many users?", answer: "20k" }], "Acme", 300);
    const merged = mergeFacts(x, y);
    expect(liveFacts(merged)).toHaveLength(2);
    expect(merged.find((f) => f.id === factId(a.area, a.question))?.updatedAt).toBe(300);
  });

  it("caps the live ledger, dropping the oldest", () => {
    const many = Array.from({ length: MAX_FACTS + 5 }, (_, i) => ({ area: `A${i}`, question: `Q${i}`, answer: `ans ${i}` }));
    const f = recordAnswers([], many, "J", 1).map((x, i) => ({ ...x, updatedAt: i }));
    expect(liveFacts(mergeFacts(f, []))).toHaveLength(MAX_FACTS);
  });
});

describe("sanitizeFacts", () => {
  it("drops malformed entries and blank live answers, keeps tombstones", () => {
    const out = sanitizeFacts([
      null,
      { id: "", answer: "x" },
      { id: "f1", area: "A", question: "Q", answer: "   ", updatedAt: 1 },
      { id: "f2", area: "A", question: "Q", answer: "ok", updatedAt: 2, createdAt: 1, job: "J" },
      { id: "f3", deleted: true, updatedAt: 3 },
    ]);
    expect(out.map((f) => f.id).sort()).toEqual(["f2", "f3"]);
    expect(sanitizeFacts("nope")).toEqual([]);
  });
});

describe("reuse", () => {
  it("finds the latest fact for the same area, ignoring case and spacing", () => {
    const f = recordAnswers([], [a], "Acme", 100);
    expect(factForArea(f, "  measured   IMPACT ")?.answer).toBe(a.answer);
    expect(factForArea(f, "Kubernetes")).toBeUndefined();
  });

  it("builds prompt lines newest first within the limit", () => {
    let f = recordAnswers([], [a], "J", 1);
    f = recordAnswers(f, [{ area: "Scale", question: "How many users?", answer: "20k" }], "J", 2);
    expect(factLines(f, 1)).toEqual([{ question: "How many users?", answer: "20k" }]);
  });
});

describe("acceptTypedFigures", () => {
  const warn = ["Unverified figure “34%” in an experience highlight.", "Unverified figure “90%” in an experience highlight."];
  it("drops warnings only for figures the candidate typed", () => {
    expect(acceptTypedFigures(warn, [{ answer: "up 34% weekly" }])).toEqual([warn[1]]);
    expect(acceptTypedFigures(warn, [])).toEqual(warn);
  });
});

describe("sanitizePromptFacts", () => {
  it("bounds count and length and drops blanks and non-objects", () => {
    const raw = [null, { answer: " " }, { question: "q", answer: "x".repeat(900) }, ...Array.from({ length: 20 }, (_, i) => ({ answer: `a${i}` }))];
    const out = sanitizePromptFacts(raw);
    expect(out).toHaveLength(12);
    expect(out[0].answer).toHaveLength(600);
    expect(sanitizePromptFacts("x")).toEqual([]);
  });
});

describe("buildPatchPrompt with facts", () => {
  it("adds a CONFIRMED FACTS block only when facts exist", () => {
    expect(buildPatchPrompt(sampleCV, "jd")).not.toContain("CONFIRMED FACTS");
    expect(buildPatchPrompt(sampleCV, "jd", [{ question: "Q?", answer: "34% lift" }])).toContain("- Q? 34% lift");
  });
});
