import { describe, it, expect } from "vitest";
import { suggestTailorStep, type TailorSignals } from "./suggestStep";

const base: TailorSignals = { hasCv: true, jd: "Senior engineer", simulated: false, missingCount: 5, refined: false };

describe("suggestTailorStep", () => {
  it("asks for a CV, then a job, first", () => {
    expect(suggestTailorStep({ ...base, hasCv: false }).step).toBe("job");
    expect(suggestTailorStep({ ...base, jd: "   " }).step).toBe("job");
  });

  it("diagnoses with Simulate before anything else", () => {
    expect(suggestTailorStep(base).step).toBe("simulate");
  });

  it("coaches while gaps remain, else goes straight to Refine", () => {
    expect(suggestTailorStep({ ...base, simulated: true }).step).toBe("coach");
    expect(suggestTailorStep({ ...base, simulated: true, missingCount: 0 }).step).toBe("refine");
  });

  it("suggests export once refined", () => {
    expect(suggestTailorStep({ ...base, simulated: true, refined: true }).step).toBe("export");
  });
});
