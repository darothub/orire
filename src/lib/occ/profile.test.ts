import { describe, expect, it } from "vitest";
import { validateCareerProfile } from "./profile";
const valid = { targetRole: "Backend engineer", location: "Europe", workMode: "Remote", salaryGoal: "80k EUR", careerGoal: "Secure a role", verifiedNotes: "Built API services" };
describe("OCC career profile input", () => {
  it("accepts and trims explicit user fields", () => {
    expect(validateCareerProfile({ ...valid, targetRole: " Backend engineer " })?.targetRole).toBe("Backend engineer");
  });
  it("rejects invalid or oversized values", () => {
    expect(validateCareerProfile({ ...valid, verifiedNotes: "a".repeat(2501) })).toBeNull();
    expect(validateCareerProfile({ ...valid, salaryGoal: 200 })).toBeNull();
    expect(validateCareerProfile(null)).toBeNull();
  });
});
