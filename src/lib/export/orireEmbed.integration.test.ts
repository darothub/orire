import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { extractText, getDocumentProxy } from "unpdf";
import { cvToReadableText, encodeOrireKeywords, decodeOrireKeywords } from "./orireEmbed";
import type { CVData } from "@/lib/cv/schema";

/**
 * Full-pipeline guard: build a PDF with the real jsPDF the exporter uses
 * (readable invisible text layer + exact CVData in Keywords metadata), then
 * read it back with the real unpdf the import route uses. Confirms the lossless
 * metadata round-trip survives for CVs of any length, and that readable text is
 * extractable. Catches regressions pure encode/decode unit tests can't see.
 */
async function roundTripThroughPdf(
  cv: CVData,
): Promise<{ embedded: CVData | null; text: string }> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  pdf.setFontSize(6);
  const lines = pdf.splitTextToSize(cvToReadableText(cv), 595.28 - 8) as string[];
  pdf.text(lines, 4, 4, { renderingMode: "invisible", baseline: "top" });
  pdf.setProperties({ keywords: encodeOrireKeywords(cv) });
  // A visible layer on top, mirroring the rasterised CV bitmap.
  pdf.setFillColor(245, 245, 245);
  pdf.rect(0, 0, 595.28, 841.89, "F");

  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: true });
  const raw = Array.isArray(text) ? text.join("\n") : text;
  const meta = await doc.getMetadata();
  const keywords = (meta?.info as { Keywords?: string } | undefined)?.Keywords;
  return { embedded: decodeOrireKeywords(keywords), text: raw };
}

function bigCV(): CVData {
  return {
    basics: {
      fullName: "Ada Lovelace",
      title: "Analytical Engineer",
      email: "ada@example.com",
      phone: "+44 20 7946 0000",
      location: "London, UK — Café ☕ 日本語",
      summary: `Pioneer of computing. ${"detailed narrative ".repeat(25)}`,
      links: [{ id: "l1", label: "Site", url: "https://ada.example" }],
    },
    experience: Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      company: `Analytical Engine Co. ${i}`,
      role: "Lead Mathematician",
      location: "London",
      startDate: "1842",
      endDate: "1843",
      current: false,
      highlights: [
        `Wrote the first published algorithm ${"with supporting detail ".repeat(8)}`,
        "Translated Menabrea's notes",
      ],
    })),
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
    skills: [
      { id: "s1", category: "Core", items: Array.from({ length: 50 }, (_, i) => `Skill ${i}`) },
    ],
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
}

describe("orire PDF round-trip (jsPDF → unpdf)", () => {
  it("losslessly recovers a large CV from the PDF metadata, with readable text", async () => {
    const cv = bigCV();
    const { embedded, text } = await roundTripThroughPdf(cv);
    expect(embedded).toEqual(cv);
    // The invisible readable layer is also extractable (fixes "no text").
    expect(text).toContain("Ada Lovelace");
  });

  it("recovers a minimal CV", async () => {
    const cv: CVData = {
      basics: {
        fullName: "Minimal Person",
        title: "",
        email: "",
        phone: "",
        location: "",
        summary: "Short.",
        links: [],
      },
      experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      order: ["summary", "experience", "education", "skills", "projects", "certifications"],
    };
    const { embedded } = await roundTripThroughPdf(cv);
    expect(embedded).toEqual(cv);
  });
});
