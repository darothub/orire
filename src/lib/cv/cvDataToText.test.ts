import { describe, expect, it } from "vitest";
import { blankCV } from "./schema";
import { cvDataToText } from "./cvDataToText";

describe("cvDataToText", () => {
  it("renders the fields OCC reasons over and skips empty ones", () => {
    const cv = blankCV();
    cv.basics.fullName = "Amara Okafor";
    cv.basics.title = "Backend Engineer";
    cv.basics.summary = "Backend engineer with payments experience.";
    cv.experience[0].company = "Mastercard";
    cv.experience[0].role = "Backend Engineer";
    cv.experience[0].highlights = ["Built Kafka-based authentication services.", ""];
    cv.skills = [{ id: "sk1", category: "Languages", items: ["Java", "Kotlin", ""] }];

    const text = cvDataToText(cv);
    expect(text).toContain("Amara Okafor — Backend Engineer");
    expect(text).toContain("SUMMARY");
    expect(text).toContain("Backend engineer with payments experience.");
    expect(text).toContain("Backend Engineer · Mastercard");
    expect(text).toContain("- Built Kafka-based authentication services.");
    expect(text).toContain("Languages: Java, Kotlin");
    // empty bullet and empty skill are dropped
    expect(text).not.toContain("- \n");
    expect(text.trim().endsWith(",")).toBe(false);
  });

  it("omits whole sections that have no content", () => {
    const cv = blankCV();
    cv.basics.fullName = "No Body";
    const text = cvDataToText(cv);
    expect(text).toContain("No Body");
    expect(text).not.toContain("EXPERIENCE");
    expect(text).not.toContain("SKILLS");
  });
});
