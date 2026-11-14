import { describe, expect, it } from "vitest";
import { buildCareerContext } from "./context";
const profile = { targetRole: "Backend engineer", location: "EU", workMode: "remote", salaryGoal: "€80k", careerGoal: "Find remote work", verifiedNotes: "I worked with Kotlin" };
describe("OCC opt-in context", () => {
  it("excludes saved profile entirely unless consent is true", () => {
    const context = buildCareerContext(false, profile, "My own goal");
    expect(context.savedCareerContext).toBeNull();
    expect(JSON.stringify(context)).not.toContain("Kotlin");
    expect(context.careerGoal).toBe("My own goal");
  });
  it("includes saved profile only with opt-in, without overriding explicit goal", () => {
    expect(buildCareerContext(true, profile, "Apply for SRE").careerGoal).toBe("Apply for SRE");
    expect(buildCareerContext(true, profile, "").careerGoal).toBe("Find remote work");
    expect(buildCareerContext(true, profile, "").savedCareerContext?.userProvidedExperienceNotes).toBe("I worked with Kotlin");
  });
  it("handles missing saved profile", () => {
    expect(buildCareerContext(true, null, "").usedSavedProfile).toBe(false);
  });
});
