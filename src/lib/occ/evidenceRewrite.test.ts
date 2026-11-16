import { describe, expect, it } from "vitest";
import { validateEvidenceRewrite } from "./evidenceRewrite";
import { parseGroundedAdvice } from "./recommendations";

describe("OCC sample rewrite safety across professions", () => {
  const cases = [
    { field: "medicine", evidence: "Reviewed patient histories and discussed treatment options.", safe: "Discussed treatment options and reviewed patient histories.", risky: "Prescribed medication and reviewed patient histories." },
    { field: "nursing", evidence: "Assisted nurses with observations and patient comfort.", safe: "Assisted with patient comfort and observations with nurses.", risky: "Administered medication and monitored patient comfort." },
    { field: "law", evidence: "Researched legal cases and drafted client correspondence.", safe: "Drafted client correspondence and researched legal cases.", risky: "Represented clients in court and researched legal cases." },
    { field: "agriculture", evidence: "Monitored crop growth and recorded irrigation schedules.", safe: "Recorded irrigation schedules and monitored crop growth.", risky: "Increased yields by 35 percent and monitored crop growth." },
    { field: "software", evidence: "Built Kotlin services and tested payment APIs.", safe: "Tested payment APIs and built Kotlin services.", risky: "Led AWS migrations and built Kotlin services." },
  ] as const;
  for (const example of cases) {
    it(example.field + ": admits reordered evidence, rejects invented responsibilities and metrics", () => {
      expect(validateEvidenceRewrite(example.evidence, example.safe)).toBe(example.safe);
      expect(validateEvidenceRewrite(example.evidence, example.risky)).toBeNull();
    });
  }
  it("rejects adding or removing negations and hiding unsupported samples", () => {
    expect(validateEvidenceRewrite("Did not administer medication in the clinic.", "Administer medication in the clinic.")).toBeNull();
    expect(validateEvidenceRewrite("Assisted with patient documentation.", "Did not assist with patient documentation.")).toBeNull();
    const cv = "Assisted nurses with observations and patient comfort.";
    const result = parseGroundedAdvice(JSON.stringify({
      summary: "Evaluate stated nursing experience.",
      recommendations: [
        { requirement: "Nursing", assessment: "supported", cvEvidence: cv,
          suggestion: "Highlight documented care.", sampleWording: "Administered intravenous injections.", question: null },
        { requirement: "Prescribing", assessment: "not-found", cvEvidence: null,
          suggestion: "Ask the candidate.", sampleWording: "Prescribed treatment.", question: "Do you have this experience?" },
      ],
    }), cv);
    expect(result.recommendations[0].sampleWording).toBeNull();
    expect(result.recommendations[1].sampleWording).toBeNull();
  });
});
