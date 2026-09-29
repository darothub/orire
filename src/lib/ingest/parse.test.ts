import { describe, it, expect } from "vitest";
import { parsedCVFromModelJSON } from "@/lib/ingest/parse";

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
});
