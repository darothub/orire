/**
 * orire — PDF round-trip embedding.
 *
 * Orire's PDF export rasterises the live CV into a bitmap for pixel-perfect
 * fidelity, which leaves the PDF with no selectable text (re-import then fails
 * with "No text could be extracted"). We fix that with two channels:
 *
 *   1. An invisible (render-mode 3) text layer holding a human-readable
 *      serialisation of the CV, so any tool (ATS, Ctrl-F, the orire importer's
 *      heuristic/AI parser) can extract real text.
 *   2. The exact CVData, base64-encoded into the PDF's document metadata
 *      (Keywords). Metadata is not bound by page geometry, so it survives for
 *      CVs of any length — enabling a lossless orire round-trip with no AI
 *      re-parse and no drift. (A text layer can only hold what fits on the
 *      page; anything drawn past the page edge is dropped by text extractors.)
 *
 * This module is DOM-free so it runs both client-side (export) and in the Node
 * API route (import), relying only on globals present in both: TextEncoder/
 * TextDecoder and btoa/atob.
 */

import type { CVData, SectionKey } from "@/lib/cv/schema";
import type { ParsedCV } from "@/lib/ingest/parse";

/** Prefix marking orire data inside the PDF Keywords metadata field. */
export const ORIRE_META_PREFIX = "ORIRE-CV-V1:";

const DEFAULT_ORDER: SectionKey[] = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
];

function join(parts: (string | undefined)[], sep = " · "): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(sep);
}

/** Readable, section-ordered plain-text serialisation of a CV. */
export function cvToReadableText(cv: CVData): string {
  const b = cv.basics;
  const out: string[] = [];
  if (b.fullName.trim()) out.push(b.fullName.trim());
  if (b.title.trim()) out.push(b.title.trim());
  const contact = join([b.email, b.phone, b.location, ...b.links.map((l) => l.url)]);
  if (contact) out.push(contact);
  out.push("");

  const order = cv.order?.length ? cv.order : DEFAULT_ORDER;
  for (const key of order) {
    if (key === "summary") {
      if (b.summary.trim()) out.push("SUMMARY", b.summary.trim(), "");
    } else if (key === "experience") {
      if (cv.experience.length) {
        out.push("EXPERIENCE");
        for (const e of cv.experience) {
          out.push(join([e.role, e.company, e.location]));
          const dates = join([e.startDate, e.current ? "Present" : e.endDate], " – ");
          if (dates) out.push(dates);
          for (const h of e.highlights) if (h.trim()) out.push(`• ${h.trim()}`);
          out.push("");
        }
      }
    } else if (key === "education") {
      if (cv.education.length) {
        out.push("EDUCATION");
        for (const ed of cv.education) {
          out.push(join([ed.degree, ed.field, ed.institution]));
          const dates = join([ed.startDate, ed.endDate], " – ");
          if (dates) out.push(dates);
          if (ed.details?.trim()) out.push(ed.details.trim());
          out.push("");
        }
      }
    } else if (key === "skills") {
      if (cv.skills.length) {
        out.push("SKILLS");
        for (const g of cv.skills) out.push(join([g.category, g.items.join(", ")], ": "));
        out.push("");
      }
    } else if (key === "projects") {
      if (cv.projects.length) {
        out.push("PROJECTS");
        for (const p of cv.projects) {
          out.push(join([p.name, p.role]));
          if (p.url) out.push(p.url);
          for (const h of p.highlights) if (h.trim()) out.push(`• ${h.trim()}`);
          out.push("");
        }
      }
    } else if (key === "certifications") {
      if (cv.certifications.length) {
        out.push("CERTIFICATIONS");
        for (const c of cv.certifications) out.push(join([c.name, c.issuer, c.date]));
        out.push("");
      }
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** The value to store in the PDF Keywords metadata field: a prefixed, base64
 * copy of the exact CVData. */
export function encodeOrireKeywords(cv: CVData): string {
  return ORIRE_META_PREFIX + utf8ToBase64(JSON.stringify(cv));
}

function looksLikeCVData(v: unknown): v is CVData {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    !!o.basics &&
    typeof o.basics === "object" &&
    Array.isArray(o.experience) &&
    Array.isArray(o.education) &&
    Array.isArray(o.skills)
  );
}

/** Decode the exact CVData from a PDF Keywords metadata value, or null when the
 * PDF wasn't produced by orire / the payload is unusable. */
export function decodeOrireKeywords(keywords: string | null | undefined): CVData | null {
  if (!keywords) return null;
  const i = keywords.indexOf(ORIRE_META_PREFIX);
  if (i === -1) return null;
  // base64 contains no whitespace; strip any a reader may have introduced.
  const b64 = keywords.slice(i + ORIRE_META_PREFIX.length).replace(/\s+/g, "");
  try {
    const obj = JSON.parse(base64ToUtf8(b64));
    if (looksLikeCVData(obj)) return obj;
  } catch {
    /* fall through */
  }
  return null;
}

/** Adapt exact CVData into the ParsedCV shape the importer already consumes, so
 * a round-tripped orire PDF restores losslessly through the existing path. */
export function parsedFromCVData(cv: CVData): ParsedCV {
  return {
    basics: cv.basics,
    experience: cv.experience,
    education: cv.education,
    skills: cv.skills,
    projects: cv.projects,
    certifications: cv.certifications,
    notes: ["Restored from orire-embedded data — exact round-trip."],
  };
}
