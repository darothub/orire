import { describe, it, expect } from "vitest";
import { factGround, parseModelJSON, RefineParseError } from "@/lib/ai/guardrails";
import type { CVData } from "@/lib/cv/schema";

/** A minimal but realistic source CV used as the grounding truth. */
function source(): CVData {
  return {
    basics: {
      fullName: "Ada Lovelace",
      title: "Engineer",
      email: "ada@example.com",
      phone: "+44 123",
      location: "London, UK",
      summary: "Original summary.",
      links: [{ id: "lnk_1", label: "Site", url: "https://ada.dev" }],
    },
    experience: [
      {
        id: "exp_1",
        company: "Analytical Engines Ltd",
        role: "Lead",
        location: "London",
        startDate: "2019",
        endDate: "2022",
        current: false,
        highlights: ["Built the first program"],
      },
    ],
    education: [
      {
        id: "edu_1",
        institution: "University of London",
        degree: "BSc Mathematics",
        field: "Mathematics",
        startDate: "2010",
        endDate: "2013",
        details: "",
      },
    ],
    skills: [{ id: "skl_1", category: "Core", items: ["Algorithms", "Mathematics"] }],
    projects: [
      {
        id: "prj_1",
        name: "Note G",
        role: "Author",
        url: "",
        startDate: "1843",
        endDate: "1843",
        highlights: ["Described Bernoulli numbers"],
      },
    ],
    certifications: [{ id: "crt_1", name: "Fellowship", issuer: "RS", date: "1840", url: "" }],
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };
}

describe("parseModelJSON", () => {
  it("parses a bare JSON object", () => {
    expect(parseModelJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json code fences", () => {
    expect(parseModelJSON('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it("locates the outermost object amid surrounding prose", () => {
    expect(parseModelJSON('Here you go:\n{"a":3}\nThanks!')).toEqual({ a: 3 });
  });

  it("throws RefineParseError when no object is present", () => {
    expect(() => parseModelJSON("no json here")).toThrow(RefineParseError);
  });

  it("throws RefineParseError on malformed JSON", () => {
    expect(() => parseModelJSON('{"a": }')).toThrow(RefineParseError);
  });
});

describe("factGround — identity locking", () => {
  it("locks name/email/phone/location/links to the source regardless of the model", () => {
    const src = source();
    const { cv } = factGround(src, {
      basics: {
        fullName: "Someone Else",
        email: "evil@x.com",
        phone: "000",
        location: "Nowhere",
        links: [{ label: "x", url: "https://x" }],
        title: "Staff Engineer",
        summary: "Sharper tailored summary.",
      },
    });
    expect(cv.basics.fullName).toBe("Ada Lovelace");
    expect(cv.basics.email).toBe("ada@example.com");
    expect(cv.basics.phone).toBe("+44 123");
    expect(cv.basics.location).toBe("London, UK");
    expect(cv.basics.links).toEqual(src.basics.links);
  });

  it("allows title + summary to be rephrased", () => {
    const { cv } = factGround(source(), {
      basics: { title: "Staff Engineer", summary: "Sharper tailored summary." },
    });
    expect(cv.basics.title).toBe("Staff Engineer");
    expect(cv.basics.summary).toBe("Sharper tailored summary.");
  });

  it("falls back to source title/summary when the model omits them", () => {
    const { cv } = factGround(source(), { basics: {} });
    expect(cv.basics.title).toBe("Engineer");
    expect(cv.basics.summary).toBe("Original summary.");
  });
});

describe("factGround — invented content warnings", () => {
  it("warns on an employer not in the source", () => {
    const { warnings } = factGround(source(), {
      experience: [{ company: "Google", role: "SWE", highlights: [] }],
    });
    expect(warnings.some((w) => w.includes("Google"))).toBe(true);
  });

  it("does not warn on a grounded employer (case/space-insensitive)", () => {
    const { warnings } = factGround(source(), {
      experience: [{ company: "  analytical   engines ltd ", role: "Lead", highlights: [] }],
    });
    expect(warnings.some((w) => w.toLowerCase().includes("employer"))).toBe(false);
  });

  it("warns on a date not present in the source", () => {
    const { warnings } = factGround(source(), {
      experience: [{ company: "Analytical Engines Ltd", startDate: "1999", highlights: [] }],
    });
    expect(warnings.some((w) => w.includes("1999"))).toBe(true);
  });

  it("removes invented skills and warns", () => {
    const { cv, warnings } = factGround(source(), {
      skills: [{ category: "Core", items: ["Algorithms", "Rust"] }],
    });
    expect(cv.skills[0].items).toEqual(["Algorithms"]);
    expect(warnings.some((w) => w.includes("Rust"))).toBe(true);
  });

  it("warns on invented institutions, degrees, projects and certifications", () => {
    const { warnings } = factGround(source(), {
      education: [{ institution: "MIT", degree: "PhD Robotics" }],
      projects: [{ name: "Skynet", highlights: [] }],
      certifications: [{ name: "AWS Pro", issuer: "Amazon" }],
    });
    expect(warnings.some((w) => w.includes("MIT"))).toBe(true);
    expect(warnings.some((w) => w.includes("PhD Robotics"))).toBe(true);
    expect(warnings.some((w) => w.includes("Skynet"))).toBe(true);
    expect(warnings.some((w) => w.includes("AWS Pro"))).toBe(true);
  });
});

describe("factGround — structure", () => {
  it("preserves the source section order", () => {
    const src = source();
    src.order = ["experience", "summary", "skills", "education", "projects", "certifications"];
    const { cv } = factGround(src, {});
    expect(cv.order).toEqual(src.order);
  });

  it("assigns fresh ids to every produced item", () => {
    const { cv } = factGround(source(), {
      experience: [{ company: "Analytical Engines Ltd", highlights: ["x"] }],
    });
    expect(cv.experience[0].id).toMatch(/^exp_/);
    expect(cv.experience[0].id).not.toBe("exp_1");
  });

  it("coerces missing arrays to empty without throwing", () => {
    const { cv } = factGround(source(), { experience: "not-an-array" });
    expect(cv.experience).toEqual([]);
  });
});
