import { describe, it, expect } from "vitest";
import { cvToPlainText } from "./plaintext";
import type { CVData } from "@/lib/cv/schema";

function sample(): CVData {
  return {
    basics: { fullName: "Ada Okonkwo", title: "Backend Engineer", email: "ada@x.com", phone: "+351 900", location: "Porto", summary: "Builds reliable systems.", links: [{ id: "l0", label: "GH", url: "github.com/ada" }] },
    experience: [
      { id: "e0", company: "Acme", role: "Engineer", location: "Remote", startDate: "2021", endDate: "", current: true, highlights: ["Led the billing rebuild.", "Cut latency 40%."] },
    ],
    education: [{ id: "ed0", institution: "State Uni", degree: "BSc", field: "CS", startDate: "2014", endDate: "2018", details: "" }],
    skills: [{ id: "s0", category: "Languages", items: ["TypeScript", "Go"] }],
    projects: [{ id: "p0", name: "Orire", role: "", url: "orire.app", startDate: "", endDate: "", highlights: ["Built it."] }],
    certifications: [{ id: "c0", name: "AWS SAA", issuer: "Amazon", date: "2022", url: "" }],
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };
}

describe("cvToPlainText", () => {
  it("renders name, title, contact and all sections in order", () => {
    const txt = cvToPlainText(sample());
    expect(txt.startsWith("Ada Okonkwo\nBackend Engineer\n")).toBe(true);
    expect(txt).toContain("ada@x.com  |  +351 900  |  Porto  |  github.com/ada");
    expect(txt).toContain("EXPERIENCE");
    expect(txt).toContain("Engineer — Acme");
    expect(txt).toContain("2021 – Present");
    expect(txt).toContain("  - Led the billing rebuild.");
    expect(txt).toContain("Languages: TypeScript, Go");
    expect(txt).toContain("AWS SAA  |  Amazon  |  2022");
    // Section order is honoured.
    expect(txt.indexOf("EXPERIENCE")).toBeLessThan(txt.indexOf("EDUCATION"));
    expect(txt.indexOf("SKILLS")).toBeLessThan(txt.indexOf("PROJECTS"));
  });

  it("has no markup and ends with a single newline", () => {
    const txt = cvToPlainText(sample());
    expect(txt).not.toMatch(/[*#_`|]{2,}/);
    expect(txt.endsWith("\n")).toBe(true);
    expect(txt).not.toMatch(/\n{3,}/);
  });

  it("handles an empty CV without throwing", () => {
    const empty: CVData = {
      basics: { fullName: "", title: "", email: "", phone: "", location: "", summary: "", links: [] },
      experience: [], education: [], skills: [], projects: [], certifications: [],
      order: ["summary", "experience", "education", "skills", "projects", "certifications"],
    };
    const txt = cvToPlainText(empty);
    expect(txt).toBe("Your Name\n");
  });

  it("respects a custom section order", () => {
    const cv = sample();
    cv.order = ["skills", "summary", "experience", "education", "projects", "certifications"];
    const txt = cvToPlainText(cv);
    expect(txt.indexOf("SKILLS")).toBeLessThan(txt.indexOf("EXPERIENCE"));
  });
});
