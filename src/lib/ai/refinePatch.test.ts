import { describe, it, expect } from "vitest";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { factGround } from "@/lib/ai/guardrails";
import type { CVData } from "@/lib/cv/schema";

function source(): CVData {
  return {
    basics: {
      fullName: "Ada Lovelace",
      title: "Engineer",
      email: "ada@example.com",
      phone: "123",
      location: "London",
      summary: "Original summary.",
      links: [{ id: "l1", label: "Site", url: "https://ada.dev" }],
    },
    experience: [
      { id: "e1", company: "Analytical Co", role: "Engineer", location: "London", startDate: "2018", endDate: "2021", current: false, highlights: ["Built the engine", "Wrote notes"] },
      { id: "e2", company: "Difference Ltd", role: "Analyst", location: "Bath", startDate: "2015", endDate: "2018", current: false, highlights: ["Computed tables"] },
    ],
    education: [{ id: "ed1", institution: "Uni", degree: "BSc", field: "Math", startDate: "2011", endDate: "2015", details: "" }],
    skills: [{ id: "s1", category: "Core", items: ["Algorithms", "Fortran"] }],
    projects: [{ id: "p1", name: "Engine", role: "Lead", url: "", startDate: "", endDate: "", highlights: ["Designed loops"] }],
    certifications: [{ id: "c1", name: "Cert A", issuer: "Org", date: "2020", url: "" }],
    order: ["summary", "experience", "education", "skills", "projects"],
  };
}

describe("applyRefinePatch", () => {
  it("carries locked identity + dates from source, applies tailored text", () => {
    const src = source();
    const patch = {
      title: "Senior Engineer",
      summary: "Tailored summary.",
      experience: [{ ref: 0, highlights: ["Led the analytical engine"] }],
    };
    const { cv } = factGround(src, applyRefinePatch(src, patch));
    expect(cv.basics.fullName).toBe("Ada Lovelace");
    expect(cv.basics.email).toBe("ada@example.com");
    expect(cv.basics.title).toBe("Senior Engineer");
    expect(cv.basics.summary).toBe("Tailored summary.");
    expect(cv.experience[0].company).toBe("Analytical Co");
    expect(cv.experience[0].startDate).toBe("2018");
    expect(cv.experience[0].highlights).toEqual(["Led the analytical engine"]);
  });

  it("preserves all original jobs in their original order despite the patch order", () => {
    const src = source();
    // Keep both but reversed via ref order.
    const patch = {
      experience: [
        { ref: 1, highlights: ["Computed tables faster"] },
        { ref: 0, highlights: ["Built the engine"] },
      ],
    };
    const out = applyRefinePatch(src, patch) as { experience: { company: string }[] };
    expect(out.experience.map((e) => e.company)).toEqual(["Analytical Co", "Difference Ltd"]);
  });

  it("ignores unreviewed reorder requests to preserve source job alignment", () => {
    const src = source();
    const patch = {
      order: [1, 0],
      experience: [
        { ref: 0, highlights: ["a"] },
        { ref: 1, highlights: ["b"] },
      ],
    };
    const out = applyRefinePatch(src, patch) as { experience: { company: string }[] };
    expect(out.experience.map((e) => e.company)).toEqual(["Analytical Co", "Difference Ltd"]);
  });

  it("falls back to full source experience when patch omits it", () => {
    const src = source();
    const out = applyRefinePatch(src, { summary: "x" }) as { experience: unknown[] };
    expect(out.experience).toHaveLength(2);
  });

  it("does NOT empty the CV when refs are all invalid", () => {
    const src = source();
    const out = applyRefinePatch(src, { experience: [{ ref: 99 }, { ref: 42 }] }) as {
      experience: unknown[];
    };
    expect(out.experience).toHaveLength(2);
  });

  it("keeps source highlights when patch highlights are empty", () => {
    const src = source();
    const out = applyRefinePatch(src, { experience: [{ ref: 0, highlights: [] }] }) as {
      experience: { highlights: string[] }[];
    };
    expect(out.experience[0].highlights).toEqual(["Built the engine", "Wrote notes"]);
  });

  it("filters invented skills through the existing guardrails", () => {
    const src = source();
    const patch = { skills: [{ category: "Core", items: ["Algorithms", "Rust"] }] };
    const { cv, warnings } = factGround(src, applyRefinePatch(src, patch));
    const items = cv.skills.flatMap((g) => g.items);
    expect(items).toContain("Algorithms");
    expect(items).not.toContain("Rust");
    expect(warnings.join(" ")).toMatch(/Rust/);
  });

  it("carries education and certifications verbatim from source", () => {
    const src = source();
    const { cv } = factGround(src, applyRefinePatch(src, {}));
    expect(cv.education[0].institution).toBe("Uni");
    expect(cv.certifications[0].name).toBe("Cert A");
  });
  it("never silently removes unreferenced experience or projects in a partial patch", () => {
    const src = source();
    const patch = {
      experience: [{ ref: 1, highlights: ["Computed tables with the original inputs"] }],
      projects: [{ ref: 900, highlights: ["Invented project"] }],
    };
    const { cv } = factGround(src, applyRefinePatch(src, patch));
    expect(cv.experience).toHaveLength(2);
    expect(cv.experience[0].highlights).toEqual(src.experience[0].highlights);
    expect(cv.experience[1].highlights).toEqual(["Computed tables with the original inputs"]);
    expect(cv.projects).toHaveLength(1);
    expect(cv.projects[0].highlights).toEqual(src.projects[0].highlights);
  });

  it("rejects hallucinated role promotions, negative refs and duplicate source refs", () => {
    const src = source();
    const patch = {
      order: [1, 1, 0],
      experience: [
        { ref: -1, role: "CEO", highlights: ["Founded a new startup"] },
        { ref: 0, role: "Chief Technology Officer", highlights: ["Improved internal software"] },
        { ref: 0, role: "Director", highlights: ["Fabricated duplicate"] },
        { ref: 99, role: "Founder", highlights: ["Fake company"] },
      ],
      projects: [{ ref: 0, role: "CTO", highlights: ["Updated original project"] }],
    };
    const { cv } = factGround(src, applyRefinePatch(src, patch));
    expect(cv.experience).toHaveLength(src.experience.length);
    expect(cv.experience.map((e) => [e.company, e.role, e.startDate, e.endDate]))
      .toEqual(src.experience.map((e) => [e.company, e.role, e.startDate, e.endDate]));
    expect(cv.experience[0].highlights).toEqual(["Improved internal software"]);
    expect(cv.experience[1].highlights).toEqual(src.experience[1].highlights);
    expect(cv.projects).toHaveLength(1);
    expect(cv.projects[0].role).toBe("Lead");
  });

  it("does not mistake malformed patches for permission to overwrite source highlights", () => {
    const src = source();
    const patch = {
      experience: [{ ref: 0, highlights: "new claim" }, { ref: 1, highlights: [null, 99, ""] }],
      projects: "not an array",
    };
    const { cv } = factGround(src, applyRefinePatch(src, patch));
    expect(cv.experience.map((e) => e.highlights))
      .toEqual(src.experience.map((e) => e.highlights));
    expect(cv.projects[0].highlights).toEqual(src.projects[0].highlights);
  });

  it("still surfaces fabricated metrics in a legitimate referenced rewrite", () => {
    const src = source();
    const patch = {
      experience: [{ ref: 0, highlights: ["Improved revenue by 999% and saved $8M."] }],
    };
    const { cv, warnings } = factGround(src, applyRefinePatch(src, patch));
    expect(cv.experience[0].highlights).toEqual(["Improved revenue by 999% and saved $8M."]);
    expect(warnings.join(" ")).toContain("999%");
    expect(warnings.join(" ")).toContain("$8M");
  });

});
