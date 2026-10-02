import { describe, it, expect } from "vitest";
import { factGround, parseModelJSON, RefineParseError, findInventedNumbers, scoreGrounding } from "@/lib/ai/guardrails";
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

  it("keeps rephrased skills that are grounded in the source (fuzzy match)", () => {
    // Source lists "Mathematics"; a rephrase to "Applied Mathematics" shares the
    // grounding token and must survive rather than being stripped.
    const { cv, warnings } = factGround(source(), {
      skills: [{ category: "Core", items: ["Applied Mathematics"] }],
    });
    expect(cv.skills[0].items).toEqual(["Applied Mathematics"]);
    expect(warnings.some((w) => w.includes("Mathematics"))).toBe(false);
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

describe("findInventedNumbers — fabricated metric guard", () => {
  it("flags a percentage and a currency figure not present in the source", () => {
    const { warnings } = factGround(source(), {
      experience: [
        { company: "Analytical Engines Ltd", role: "Lead", highlights: ["Grew signups 400% and cut costs $1.2M"] },
      ],
    });
    expect(warnings.some((w) => w.includes("400%"))).toBe(true);
    expect(warnings.some((w) => w.includes("$1.2M"))).toBe(true);
  });

  it("does not flag figures that are grounded in the source (e.g. dates)", () => {
    const cv = factGround(source(), {
      experience: [{ company: "Analytical Engines Ltd", role: "Lead", highlights: ["Active from 2019 to 2022"] }],
    }).cv;
    expect(findInventedNumbers(source(), cv)).toEqual([]);
  });

  it("flags an invented figure in the tailored summary", () => {
    const { warnings } = factGround(source(), { basics: { summary: "Engineer with 15 years of impact." } });
    expect(warnings.some((w) => w.startsWith("Unverified figure") && w.includes("15"))).toBe(true);
  });

  it("deduplicates repeated figures within the same context", () => {
    const cv = factGround(source(), {
      experience: [{ company: "Analytical Engines Ltd", role: "Lead", highlights: ["Hit 99% and 99% again"] }],
    }).cv;
    const notes = findInventedNumbers(source(), cv).filter((w) => w.includes("99%"));
    expect(notes).toHaveLength(1);
  });
});

describe("scoreGrounding — deterministic fidelity", () => {
  it("returns a perfect clean score with no warnings", () => {
    const s = scoreGrounding({ cv: source(), warnings: [] });
    expect(s).toEqual({ score: 100, label: "clean", counts: { total: 0, entity: 0, number: 0, skill: 0 } });
  });

  it("weighs entities heaviest, then figures, then removed skills", () => {
    const s = scoreGrounding({
      cv: source(),
      warnings: [
        'Employer “Google” is not in your source CV.',
        'Unverified figure “40%” in your summary does not appear in your source CV — verify before sending.',
        'Skill “Rust” is not in your source CV and was removed.',
      ],
    });
    expect(s.counts).toEqual({ total: 3, entity: 1, number: 1, skill: 1 });
    expect(s.score).toBe(100 - 8 - 6 - 3);
    expect(s.label).toBe("minor");
  });

  it("drops to the review band and floors at zero under heavy fabrication", () => {
    const warnings = Array.from({ length: 20 }, (_, i) => `Employer “X${i}” is not in your source CV.`);
    const s = scoreGrounding({ cv: source(), warnings });
    expect(s.score).toBe(0);
    expect(s.label).toBe("review");
  });
});
