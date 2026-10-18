import { describe, it, expect } from "vitest";
import { parsedCVFromModelJSON, parseCVText } from "@/lib/ingest/parse";

describe("parsedCVFromModelJSON", () => {
  it("maps a well-formed model object into a ParsedCV with ids", () => {
    const parsed = parsedCVFromModelJSON({
      basics: {
        fullName: "Ada Lovelace",
        title: "Engineer",
        email: "ada@example.com",
        phone: "+1 555 0100",
        location: "London",
        summary: "Pioneer.",
        links: [{ label: "GitHub", url: "https://github.com/ada" }],
      },
      experience: [
        { company: "Analytical Engines", role: "Lead", startDate: "1842", endDate: "", current: true, highlights: ["Wrote the first algorithm"] },
      ],
      education: [{ institution: "Home", degree: "Mathematics" }],
      skills: [{ category: "Core", items: ["Algorithms", "Mathematics"] }],
      projects: [{ name: "Note G", highlights: ["Bernoulli numbers"] }],
      certifications: [{ name: "Fellowship", issuer: "Society", date: "1843" }],
    });

    expect(parsed.basics.fullName).toBe("Ada Lovelace");
    expect(parsed.basics.email).toBe("ada@example.com");
    expect(parsed.basics.links?.[0]).toMatchObject({ label: "GitHub", url: "https://github.com/ada" });
    expect(parsed.basics.links?.[0].id).toBeTruthy();
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0]).toMatchObject({ company: "Analytical Engines", role: "Lead", current: true });
    expect(parsed.experience[0].highlights).toEqual(["Wrote the first algorithm"]);
    expect(parsed.education[0]).toMatchObject({ institution: "Home", degree: "Mathematics" });
    expect(parsed.skills[0].items).toEqual(["Algorithms", "Mathematics"]);
    expect(parsed.projects[0].name).toBe("Note G");
    expect(parsed.certifications[0]).toMatchObject({ name: "Fellowship", issuer: "Society", date: "1843" });
    expect(parsed.notes).toHaveLength(0);
  });

  it("drops empty entries and reports missing name", () => {
    const parsed = parsedCVFromModelJSON({
      basics: {},
      experience: [{ company: "", role: "", highlights: [] }],
      education: [{ institution: "", degree: "" }],
      skills: [{ category: "Empty", items: [] }],
    });
    expect(parsed.experience).toHaveLength(0);
    expect(parsed.education).toHaveLength(0);
    expect(parsed.skills).toHaveLength(0);
    expect(parsed.notes.some((n) => /name/i.test(n))).toBe(true);
  });

  it("tolerates missing and non-array fields without throwing", () => {
    const parsed = parsedCVFromModelJSON({ basics: { fullName: "X Y" } });
    expect(parsed.basics.fullName).toBe("X Y");
    expect(parsed.experience).toEqual([]);
    expect(parsed.skills).toEqual([]);
    expect(parsed.certifications).toEqual([]);
  });

  it("coerces non-string scalars to strings", () => {
    const parsed = parsedCVFromModelJSON({
      basics: { fullName: "A B", phone: 5550100 },
      certifications: [{ name: "C", date: 2020 }],
    });
    expect(parsed.basics.phone).toBe("5550100");
    expect(parsed.certifications[0].date).toBe("2020");
  });

  it("flags experience entries the assistant returned with no dates", () => {
    const parsed = parsedCVFromModelJSON({
      basics: { fullName: "A B" },
      experience: [
        { company: "Acme", role: "Engineer", startDate: "2020", endDate: "2022", highlights: ["Did things"] },
        { company: "Beta", role: "Lead", startDate: "", endDate: "", highlights: ["Did more things"] },
      ],
    });
    expect(parsed.notes.some((n) => /no dates/i.test(n))).toBe(true);
  });
});

describe("parseCVText — confidence notes (the \"check this\" review step reads these)", () => {
  it("reports no notes for a cleanly-structured CV", () => {
    const text = [
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Experience",
      "Lead Engineer — Analytical Engines — 2020 - 2022",
      "- Wrote the first published algorithm",
      "",
      "Education",
      "University of London",
      "BSc Mathematics",
      "",
      "Skills",
      "Mathematics, Algorithms",
    ].join("\n");
    const parsed = parseCVText(text);
    expect(parsed.basics.email).toBe("ada@example.com");
    expect(parsed.notes).toEqual([]);
  });

  it("flags a missing email", () => {
    const text = ["Ada Lovelace", "", "Experience", "Engineer — Acme — 2020 - 2022", "- Did things"].join("\n");
    expect(parseCVText(text).notes.some((n) => /email/i.test(n))).toBe(true);
  });

  it("flags experience entries with no detected date range", () => {
    const text = [
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Experience",
      "Engineer — Acme",
      "- Did things, no dates in this line",
    ].join("\n");
    const parsed = parseCVText(text);
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0].startDate).toBe("");
    expect(parsed.notes.some((n) => /no dates detected/i.test(n))).toBe(true);
  });

  it("flags experience entries where role/company couldn't be split", () => {
    const text = [
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Experience",
      "Just one unsplit line 2020 - 2022",
      "- Did things",
    ].join("\n");
    const parsed = parseCVText(text);
    expect(parsed.experience[0].company).toBe("");
    expect(parsed.notes.some((n) => /merged/i.test(n))).toBe(true);
  });

  it("flags education entries that don't clearly match an institution name", () => {
    const text = [
      "Ada Lovelace",
      "ada@example.com",
      "",
      "Education",
      "Something 2015 - 2019",
    ].join("\n");
    const parsed = parseCVText(text);
    expect(parsed.education).toHaveLength(1);
    expect(parsed.notes.some((n) => /institution/i.test(n))).toBe(true);
  });
});
