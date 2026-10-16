"use client";

/**
 * orire — Word (.docx) export.
 *
 * Unlike the PDF (a rasterised snapshot of the live template for pixel
 * fidelity), the .docx is generated straight from the structured CVData. That
 * makes it fully text-native and single-column — the layout ATS parse most
 * reliably — and lightly editable in Word. It intentionally does NOT mirror the
 * visual template; it is the clean, submission-grade version of the same facts.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";
import type {
  CVData,
  ExperienceItem,
  EducationItem,
  ProjectItem,
  CertificationItem,
  SkillGroup,
  SectionKey,
} from "@/lib/cv/schema";
import { SECTION_LABELS, ALL_SECTIONS } from "@/lib/cv/schema";

function dateRange(start?: string, end?: string, current?: boolean): string {
  const s = (start ?? "").trim();
  const e = current ? "Present" : (end ?? "").trim();
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

/** A section heading with a thin bottom rule — mirrors a conventional CV look. */
function sectionHeading(label: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 2, color: "999999" } },
    children: [new TextRun({ text: label.toUpperCase(), bold: true })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 40 } });
}

function experienceBlock(items: ExperienceItem[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const it of items) {
    const when = dateRange(it.startDate, it.endDate, it.current);
    const head = [it.role, it.company].filter(Boolean).join(" — ");
    out.push(
      new Paragraph({
        spacing: { before: 120, after: 0 },
        children: [
          new TextRun({ text: head, bold: true }),
          ...(when || it.location
            ? [new TextRun({ text: `   ${[when, it.location].filter(Boolean).join(" · ")}`, italics: true, color: "666666" })]
            : []),
        ],
      }),
    );
    for (const h of it.highlights.filter((x) => x.trim())) out.push(bullet(h.trim()));
  }
  return out;
}

function educationBlock(items: EducationItem[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const it of items) {
    const when = dateRange(it.startDate, it.endDate);
    const degree = [it.degree, it.field].filter(Boolean).join(", ");
    out.push(
      new Paragraph({
        spacing: { before: 120, after: 0 },
        children: [
          new TextRun({ text: it.institution, bold: true }),
          ...(when ? [new TextRun({ text: `   ${when}`, italics: true, color: "666666" })] : []),
        ],
      }),
    );
    if (degree) out.push(new Paragraph({ text: degree, spacing: { after: 20 } }));
    if (it.details?.trim()) out.push(new Paragraph({ text: it.details.trim(), spacing: { after: 20 } }));
  }
  return out;
}

function skillsBlock(groups: SkillGroup[]): Paragraph[] {
  return groups
    .filter((g) => g.items.filter((i) => i.trim()).length)
    .map(
      (g) =>
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${g.category}: `, bold: true }),
            new TextRun({ text: g.items.filter((i) => i.trim()).join(", ") }),
          ],
        }),
    );
}

function projectsBlock(items: ProjectItem[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const it of items) {
    const when = dateRange(it.startDate, it.endDate);
    const head = [it.name, it.role].filter(Boolean).join(" — ");
    out.push(
      new Paragraph({
        spacing: { before: 120, after: 0 },
        children: [
          new TextRun({ text: head, bold: true }),
          ...(it.url ? [new TextRun({ text: `   ${it.url}`, italics: true, color: "666666" })] : []),
          ...(when ? [new TextRun({ text: `   ${when}`, italics: true, color: "666666" })] : []),
        ],
      }),
    );
    for (const h of it.highlights.filter((x) => x.trim())) out.push(bullet(h.trim()));
  }
  return out;
}

function certsBlock(items: CertificationItem[]): Paragraph[] {
  return items.map(
    (it) =>
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: it.name, bold: true }),
          ...(it.issuer || it.date
            ? [new TextRun({ text: `   ${[it.issuer, it.date].filter(Boolean).join(" · ")}`, italics: true, color: "666666" })]
            : []),
        ],
      }),
  );
}

function sectionParagraphs(cv: CVData, key: SectionKey): Paragraph[] {
  switch (key) {
    case "summary":
      return cv.basics.summary.trim()
        ? [sectionHeading(SECTION_LABELS.summary), new Paragraph({ text: cv.basics.summary.trim() })]
        : [];
    case "experience":
      return cv.experience.length ? [sectionHeading(SECTION_LABELS.experience), ...experienceBlock(cv.experience)] : [];
    case "education":
      return cv.education.length ? [sectionHeading(SECTION_LABELS.education), ...educationBlock(cv.education)] : [];
    case "skills":
      return cv.skills.length ? [sectionHeading(SECTION_LABELS.skills), ...skillsBlock(cv.skills)] : [];
    case "projects":
      return cv.projects.length ? [sectionHeading(SECTION_LABELS.projects), ...projectsBlock(cv.projects)] : [];
    case "certifications":
      return cv.certifications.length ? [sectionHeading(SECTION_LABELS.certifications), ...certsBlock(cv.certifications)] : [];
    default:
      return [];
  }
}

function safeName(name: string): string {
  const n = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ");
  return n || "cv";
}

/** Build the Word document from the CV facts. Pure (no DOM) — unit-testable. */
export function buildCvDocx(cv: CVData): Document {
  const b = cv.basics;
  const header: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: b.fullName.trim() || "Your Name", bold: true, size: 36 })],
    }),
  ];
  if (b.title.trim()) {
    header.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [new TextRun({ text: b.title.trim(), color: "444444", size: 24 })],
      }),
    );
  }
  const contact = [b.email, b.phone, b.location, ...b.links.map((l) => l.url)]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join("  |  ");
  if (contact) {
    header.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: contact, size: 18, color: "666666" })],
      }),
    );
  }

  const order = cv.order?.length ? cv.order : ALL_SECTIONS;
  const body = order.flatMap((key) => sectionParagraphs(cv, key));

  return new Document({
    creator: "Orire",
    title: `${b.fullName.trim() || "CV"} — CV`,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 21 } }, // ~10.5pt
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [...header, ...body],
      },
    ],
  });
}

/** Generate and download the CV as a .docx. Returns false only on failure. */
export async function exportCVtoDocx(fileName: string, cv: CVData): Promise<boolean> {
  try {
    const blob = await Packer.toBlob(buildCvDocx(cv));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName(fileName)}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick so the download has grabbed the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
