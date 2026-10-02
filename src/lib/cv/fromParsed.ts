/**
 * orire — pure ParsedCV → CVData converter.
 *
 * Builds a complete, render-ready CVData from a ParsedCV without touching any
 * store. Used by the Re-brand flow (req 3) to hold a restructured draft that can
 * be previewed in any template before it is applied to the working document.
 * Fact-grounded: it only maps fields the parser/assistant already extracted.
 */

import { ALL_SECTIONS, type CVData } from "./schema";
import type { ParsedCV } from "@/lib/ingest/parse";

export function cvDataFromParsed(parsed: ParsedCV): CVData {
  const p = parsed.basics;
  return {
    basics: {
      fullName: p.fullName ?? "",
      title: p.title ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      location: p.location ?? "",
      summary: p.summary ?? "",
      links: p.links ?? [],
    },
    experience: parsed.experience,
    education: parsed.education,
    skills: parsed.skills,
    projects: parsed.projects ?? [],
    certifications: parsed.certifications ?? [],
    order: [...ALL_SECTIONS],
  };
}
