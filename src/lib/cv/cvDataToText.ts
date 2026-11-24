import type { CVData, ExperienceItem, ProjectItem } from "./schema";

/**
 * orire — deterministic CVData -> plain text.
 *
 * Renders a structured working CV into the same kind of plain text a pasted or
 * uploaded CV produces, so OCC's text-based routes (advise, match) can run on a
 * structured draft without a second, draft-only code path. Pure and lossless
 * for the fields OCC reasons over; it never invents content — empty fields are
 * simply skipped.
 */

function dateRange(start?: string, end?: string, current?: boolean): string {
  const to = current ? "Present" : (end ?? "").trim();
  const from = (start ?? "").trim();
  if (from && to) return `${from} – ${to}`;
  return from || to || "";
}

function roleHeader(e: ExperienceItem): string {
  const who = [e.role, e.company].filter(part => part && part.trim()).join(" · ");
  const when = dateRange(e.startDate, e.endDate, e.current);
  const where = (e.location ?? "").trim();
  return [who, where, when].filter(Boolean).join(" | ");
}

function projectHeader(p: ProjectItem): string {
  const who = [p.name, p.role].filter(part => part && part.trim()).join(" · ");
  const when = dateRange(p.startDate, p.endDate);
  return [who, when].filter(Boolean).join(" | ");
}

export function cvDataToText(cv: CVData): string {
  const out: string[] = [];
  const { basics } = cv;

  const header = [basics.fullName, basics.title].filter(v => v && v.trim()).join(" — ");
  if (header) out.push(header);
  const contact = [basics.email, basics.phone, basics.location, ...basics.links.map(l => l.url)]
    .filter(v => v && v.trim());
  if (contact.length) out.push(contact.join(" · "));

  const section = (title: string, body: string[]) => {
    if (!body.length) return;
    out.push("", title.toUpperCase());
    out.push(...body);
  };

  if (basics.summary.trim()) section("Summary", [basics.summary.trim()]);

  section("Experience", cv.experience.flatMap(e => {
    const head = roleHeader(e);
    const bullets = e.highlights.filter(h => h.trim()).map(h => `- ${h.trim()}`);
    return head || bullets.length ? [head, ...bullets].filter(Boolean) : [];
  }));

  section("Projects", cv.projects.flatMap(p => {
    const head = projectHeader(p);
    const bullets = p.highlights.filter(h => h.trim()).map(h => `- ${h.trim()}`);
    return head || bullets.length ? [head, ...bullets].filter(Boolean) : [];
  }));

  section("Skills", cv.skills.flatMap(g => {
    const items = g.items.filter(s => s.trim());
    if (!items.length) return [];
    return [g.category.trim() ? `${g.category.trim()}: ${items.join(", ")}` : items.join(", ")];
  }));

  section("Education", cv.education.flatMap(ed => {
    const line = [ed.degree, ed.field, ed.institution].filter(v => v && v.trim()).join(", ");
    const when = dateRange(ed.startDate, ed.endDate);
    const head = [line, when].filter(Boolean).join(" | ");
    const details = (ed.details ?? "").trim();
    return [head, details].filter(Boolean);
  }));

  section("Certifications", cv.certifications.flatMap(c => {
    const line = [c.name, c.issuer, c.date].filter(v => v && v.trim()).join(" · ");
    return line ? [line] : [];
  }));

  return out.join("\n").trim();
}
