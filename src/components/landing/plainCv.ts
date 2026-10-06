import type { CVData } from "@/lib/cv/schema";

/**
 * Flattens a CV into the kind of plain, unstyled text a visitor would paste
 * from a Word doc or old PDF — the "before" state in the landing demo's
 * before/after toggle. Deterministic and pure so it can be unit-tested.
 */
export function plainCvLines(cv: CVData): string[] {
  const lines: string[] = [];
  const b = cv.basics;

  lines.push(b.fullName || "");
  if (b.title) lines.push(b.title);

  const contact = [b.email, b.phone, b.location].filter(Boolean).join("  |  ");
  if (contact) lines.push(contact);
  if (b.summary) {
    lines.push("");
    lines.push(b.summary);
  }

  if (cv.experience.length) {
    lines.push("");
    lines.push("EXPERIENCE");
    for (const e of cv.experience) {
      const when = e.current ? `${e.startDate}-present` : [e.startDate, e.endDate].filter(Boolean).join("-");
      lines.push(`${e.role}, ${e.company}${when ? ` (${when})` : ""}`);
      for (const h of e.highlights) lines.push(`- ${h}`);
    }
  }

  if (cv.education.length) {
    lines.push("");
    lines.push("EDUCATION");
    for (const ed of cv.education) {
      const deg = [ed.degree, ed.field].filter(Boolean).join(" ");
      lines.push(`${deg}${deg ? ", " : ""}${ed.institution}`);
    }
  }

  if (cv.skills.length) {
    lines.push("");
    lines.push("SKILLS");
    for (const s of cv.skills) {
      lines.push(`${s.category}: ${s.items.join(", ")}`);
    }
  }

  return lines;
}
