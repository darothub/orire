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

  it("keeps only referenced experiences and honours patch order", () => {
    const src = source();
    // Keep both but reversed via ref order.
    const patch = {
      experience: [
        { ref: 1, highlights: ["Computed tables faster"] },
        { ref: 0, highlights: ["Built the engine"] },
      ],
    };
    const out = applyRefinePatch(src, patch) as { experience: { company: string }[] };
    expect(out.experience.map((e) => e.company)).toEqual(["Difference Ltd", "Analytical Co"]);
  });

  it("applies explicit order array by source ref", () => {
    const src = source();
    const patch = {
      order: [1, 0],
      experience: [
        { ref: 0, highlights: ["a"] },
        { ref: 1, highlights: ["b"] },
      ],
    };
    const out = applyRefinePatch(src, patch) as { experience: { company: string }[] };
    expect(out.experience.map((e) => e.company)).toEqual(["Difference Ltd", "Analytical Co"]);
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
});
