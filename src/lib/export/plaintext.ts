/**
 * orire — plain-text CV export.
 *
 * The "paste into Workday / an application form" reality: a clean, single-column
 * text rendering of the CV with no markup, derived straight from CVData (same
 * source as the .docx). Section order follows the user's chosen `order`.
 */

import type { CVData, SectionKey } from "@/lib/cv/schema";
import { SECTION_LABELS, ALL_SECTIONS } from "@/lib/cv/schema";

function dateRange(start?: string, end?: string, current?: boolean): string {
  const s = (start ?? "").trim();
  const e = current ? "Present" : (end ?? "").trim();
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

/** "a  |  b  |  c" from the non-empty parts. */
const join = (parts: (string | undefined)[], sep = "  |  "): string =>
  parts.map((p) => (p ?? "").trim()).filter(Boolean).join(sep);

function heading(label: string): string[] {
  return ["", label.toUpperCase(), "-".repeat(label.length)];
}

function sectionLines(cv: CVData, key: SectionKey): string[] {
  switch (key) {
    case "summary":
      return cv.basics.summary.trim() ? [...heading(SECTION_LABELS.summary), cv.basics.summary.trim()] : [];
    case "experience": {
      if (!cv.experience.length) return [];
      const out = heading(SECTION_LABELS.experience);
      for (const it of cv.experience) {
        out.push(join([[it.role, it.company].filter(Boolean).join(" — "), dateRange(it.startDate, it.endDate, it.current), it.location]));
        for (const h of it.highlights.filter((x) => x.trim())) out.push(`  - ${h.trim()}`);
      }
      return out;
    }
    case "education": {
      if (!cv.education.length) return [];
      const out = heading(SECTION_LABELS.education);
      for (const it of cv.education) {
        out.push(join([it.institution, dateRange(it.startDate, it.endDate)]));
        const degree = [it.degree, it.field].filter(Boolean).join(", ");
        if (degree) out.push(`  ${degree}`);
        if (it.details?.trim()) out.push(`  ${it.details.trim()}`);
      }
      return out;
    }
    case "skills": {
      const groups = cv.skills.filter((g) => g.items.filter((i) => i.trim()).length);
      if (!groups.length) return [];
      return [...heading(SECTION_LABELS.skills), ...groups.map((g) => `${g.category}: ${g.items.filter((i) => i.trim()).join(", ")}`)];
    }
    case "projects": {
      if (!cv.projects.length) return [];
      const out = heading(SECTION_LABELS.projects);
      for (const it of cv.projects) {
        out.push(join([[it.name, it.role].filter(Boolean).join(" — "), dateRange(it.startDate, it.endDate), it.url]));
        for (const h of it.highlights.filter((x) => x.trim())) out.push(`  - ${h.trim()}`);
      }
      return out;
    }
    case "certifications": {
      if (!cv.certifications.length) return [];
      return [
        ...heading(SECTION_LABELS.certifications),
        ...cv.certifications.map((c) => join([c.name, c.issuer, c.date])),
      ];
    }
    default:
      return [];
  }
}

/** Render a CV as clean, ATS/paste-friendly plain text. */
export function cvToPlainText(cv: CVData): string {
  const b = cv.basics;
  const lines: string[] = [];
  lines.push((b.fullName.trim() || "Your Name"));
  if (b.title.trim()) lines.push(b.title.trim());
  const contact = join([b.email, b.phone, b.location, ...b.links.map((l) => l.url)]);
  if (contact) lines.push(contact);

  const order = cv.order?.length ? cv.order : ALL_SECTIONS;
  for (const key of order) lines.push(...sectionLines(cv, key));

  // Collapse 3+ blank lines, trim trailing whitespace per line, end with one NL.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "").trim() + "\n";
}
