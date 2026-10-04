import { describe, it, expect } from "vitest";
import {
  cvToReadableText,
  encodeOrireKeywords,
  decodeOrireKeywords,
  parsedFromCVData,
  ORIRE_META_PREFIX,
} from "./orireEmbed";
import type { CVData } from "@/lib/cv/schema";

const cv: CVData = {
  basics: {
    fullName: "Ada Lovelace",
    title: "Analytical Engineer",
    email: "ada@example.com",
    phone: "+44 20 7946 0000",
    location: "London, UK",
    summary: "Pioneer of computing with a focus on algorithms.",
    links: [{ id: "l1", label: "Site", url: "https://ada.example" }],
  },
  experience: [
    {
      id: "e1",
      company: "Analytical Engine Co.",
      role: "Lead Mathematician",
      location: "London",
      startDate: "1842",
      endDate: "1843",
      current: false,
      highlights: ["Wrote the first algorithm", "Translated Menabrea's notes"],
    },
  ],
  education: [
    {
      id: "ed1",
      institution: "Private tutors",
      degree: "Mathematics",
      field: "Analysis",
      startDate: "1830",
      endDate: "1835",
      details: "Studied under De Morgan",
    },
  ],
  skills: [{ id: "s1", category: "Core", items: ["Algorithms", "Mathematics", "Logic"] }],
  projects: [
    {
      id: "p1",
      name: "Bernoulli program",
      role: "Author",
      url: "https://bernoulli.example",
      startDate: "1843",
      endDate: "1843",
      highlights: ["Computed Bernoulli numbers"],
    },
  ],
  certifications: [{ id: "c1", name: "Fellow", issuer: "RS", date: "1843", url: "" }],
  order: ["summary", "experience", "education", "skills", "projects", "certifications"],
};

describe("orireEmbed", () => {
  it("serialises a CV to readable, section-ordered text", () => {
    const text = cvToReadableText(cv);
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("EXPERIENCE");
    expect(text).toContain("• Wrote the first algorithm");
    expect(text).toContain("Algorithms, Mathematics, Logic");
    // Summary precedes Experience per order.
    expect(text.indexOf("SUMMARY")).toBeLessThan(text.indexOf("EXPERIENCE"));
  });

  it("round-trips exact CVData through encode → decode (keywords)", () => {
    const keywords = encodeOrireKeywords(cv);
    expect(keywords.startsWith(ORIRE_META_PREFIX)).toBe(true);
    expect(decodeOrireKeywords(keywords)).toEqual(cv);
  });

  it("survives whitespace injected into the keywords by a PDF reader", () => {
    const keywords = encodeOrireKeywords(cv);
    // Simulate a reader breaking the base64 with spaces/newlines.
    const mangled = keywords.replace(/(.{40})/g, "$1 \n");
    expect(decodeOrireKeywords(mangled)).toEqual(cv);
  });

  it("returns null for ordinary keywords with no orire prefix", () => {
    expect(decodeOrireKeywords("cv, resume, london")).toBeNull();
    expect(decodeOrireKeywords(null)).toBeNull();
    expect(decodeOrireKeywords(undefined)).toBeNull();
  });

  it("returns null when the payload is corrupt", () => {
    expect(decodeOrireKeywords(`${ORIRE_META_PREFIX}not-valid-base64!!!`)).toBeNull();
  });

  it("adapts CVData into a ParsedCV the importer consumes", () => {
    const parsed = parsedFromCVData(cv);
    expect(parsed.basics.fullName).toBe("Ada Lovelace");
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.skills[0].items).toContain("Algorithms");
    expect(parsed.notes[0]).toMatch(/round-trip/i);
  });

  it("handles unicode content in the embedded payload", () => {
    const uni: CVData = {
      ...cv,
      basics: { ...cv.basics, fullName: "José Ñoño 日本語", summary: "Café ☕ résumé" },
    };
    const decoded = decodeOrireKeywords(encodeOrireKeywords(uni));
    expect(decoded?.basics.fullName).toBe("José Ñoño 日本語");
    expect(decoded?.basics.summary).toBe("Café ☕ résumé");
  });
});
