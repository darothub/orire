import { describe, expect, it } from "vitest";
import { looksLikeCV, looksLikeJobDescription } from "./document-validation";

describe("OCC document-purpose validation", () => {
  it("accepts structured CVs and concise professional summaries", () => {
    expect(looksLikeCV("Alex Morgan\nProfessional Experience\nSoftware Engineer at Example Ltd\nSkills\nJava, SQL, Kotlin")).toBe(true);
    expect(looksLikeCV("Senior software engineer building reliable payment and authentication services. Experienced with Java, Kotlin and API integration.")).toBe(true);
    expect(looksLikeCV("Experienced backend software engineer working on secure Java payment APIs, authentication and automated testing.")).toBe(true);
    expect(looksLikeCV("Senior engineer creating reliable Java and Kotlin payment services, with authentication and integration testing expertise.")).toBe(true);
  });
  it("rejects generic PDFs, stories and job adverts as CVs", () => {
    expect(looksLikeCV("This quarterly report shows that growth increased rapidly. Revenue continues to rise in the second quarter.")).toBe(false);
    expect(looksLikeCV("We are looking for a software engineer to build Java payment services. Apply for this job today.")).toBe(false);
    expect(looksLikeCV("An interesting research paper on digital ecosystems and distributed networks with illustrations.")).toBe(false);
    expect(looksLikeCV("")).toBe(false);
  });
  it("recognizes role descriptions independently of CVs", () => {
    expect(looksLikeJobDescription("We are looking for a backend engineer. Responsibilities include building Java services and APIs.")).toBe(true);
    expect(looksLikeJobDescription("Meeting notes about annual goals and upcoming milestones.")).toBe(false);
  });
});
