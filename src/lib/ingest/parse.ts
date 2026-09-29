/**
 * orire — heuristic CV text parser.
 *
 * Fact-grounding: this maps *verbatim* text extracted from an uploaded CV into
 * the CVData model. It never invents content — every value returned traces back
 * to a substring of the source. Anything it cannot confidently classify is left
 * out so the user can fill it in by hand. A later AI layer may re-map the same
 * raw text, but must obey the same rule.
 */

import {
  type ExperienceItem,
  type EducationItem,
  type SkillGroup,
  type ProjectItem,
  type CertificationItem,
  type Link,
  type CVBasics,
  uid,
} from "@/lib/cv/schema";

export interface ParsedCV {
  basics: Partial<CVBasics>;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  /** Non-fatal notes about what was/wasn't detected. */
  notes: string[];
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /((https?:\/\/)?(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/[^\s,;]*)?)/gi;
const DATE_RANGE_RE =
  /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)?\.?\s*\d{4}|present|current)\s*[–—\-to]+\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)?\.?\s*\d{4}|present|current)/i;

type SectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "other";

const HEADINGS: Record<Exclude<SectionKind, "other">, RegExp> = {
  summary: /^(professional\s+)?(summary|profile|about(\s+me)?|objective|overview)\s*:?\s*$/i,
  experience:
    /^(work\s+|professional\s+|employment\s+)?(experience|history|employment)\s*:?\s*$/i,
  education: /^(education|academic(\s+background)?|qualifications)\s*:?\s*$/i,
  skills:
    /^(technical\s+|core\s+|key\s+)?(skills|competencies|technologies|expertise|tools)\s*:?\s*$/i,
  projects: /^(projects|portfolio|selected\s+work|personal\s+projects)\s*:?\s*$/i,
  certifications:
    /^(certifications?|licen[sc]es?|certificates?|accreditations?|courses)\s*:?\s*$/i,
};

function detectHeading(line: string): Exclude<SectionKind, "other"> | null {
  const t = line.trim();
  if (!t || t.length > 40) return null;
  for (const [kind, re] of Object.entries(HEADINGS)) {
    if (re.test(t)) return kind as Exclude<SectionKind, "other">;
  }
  return null;
}

const BULLET_RE = /^\s*[•▪◦‣·*\-–—]\s+/;
function isBullet(line: string): boolean {
  return BULLET_RE.test(line);
}
function stripBullet(line: string): string {
  return line.replace(BULLET_RE, "").trim();
}

function looksLikeName(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  if (EMAIL_RE.test(t) || /\d/.test(t) || t.includes("@")) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  // Mostly capitalized or all-caps words.
  return words.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w) || /^[A-Z.'-]+$/.test(w));
}

function collectLinks(text: string): Link[] {
  const links: Link[] = [];
  const seen = new Set<string>();
  const matches = text.match(URL_RE) ?? [];
  for (const m of matches) {
    const url = m.trim().replace(/[.,;]$/, "");
    if (url.length < 5) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    if (/@/.test(url)) continue;
    seen.add(key);
    let label = "Website";
    if (/linkedin/i.test(url)) label = "LinkedIn";
    else if (/github/i.test(url)) label = "GitHub";
    else if (/gitlab/i.test(url)) label = "GitLab";
    else if (/behance/i.test(url)) label = "Behance";
    else if (/dribbble/i.test(url)) label = "Dribbble";
    else if (/twitter|x\.com/i.test(url)) label = "Twitter";
    links.push({ id: uid("lnk"), label, url });
    if (links.length >= 6) break;
  }
  return links;
}

const EXP_SEP_RE = /\s+(?:at|@|—|–|\||,)\s+/i;

/** True when a line looks like the start of a new experience entry. */
function isExperienceHeader(line: string): boolean {
  if (isBullet(line)) return false;
  return DATE_RANGE_RE.test(line) || EXP_SEP_RE.test(line);
}

function finishExperience(header: string[], bullets: string[]): ExperienceItem | null {
  if (header.length === 0 && bullets.length === 0) return null;
  const headerText = header.join(" • ");
  const dateMatch = headerText.match(DATE_RANGE_RE);
  let startDate = "";
  let endDate = "";
  let current = false;
  if (dateMatch) {
    startDate = dateMatch[1].trim();
    endDate = dateMatch[2].trim();
    if (/present|current/i.test(endDate)) {
      current = true;
      endDate = "";
    }
  }
  const cleaned = headerText.replace(DATE_RANGE_RE, "").replace(/\s+[•|,-]\s*$/, "").trim();
  let role = cleaned;
  let company = "";
  const parts = cleaned.split(EXP_SEP_RE);
  if (parts.length >= 2) {
    role = parts[0].trim();
    company = parts.slice(1).join(", ").replace(/•/g, "").trim();
  }
  return {
    id: uid("exp"),
    company: company || (role ? "" : cleaned),
    role,
    location: "",
    startDate,
    endDate,
    current,
    highlights: bullets.length ? bullets : [""],
  };
}

/** Line-driven experience parsing: bullets attach to the current entry. */
function parseExperience(lines: string[]): ExperienceItem[] {
  const out: ExperienceItem[] = [];
  let header: string[] = [];
  let bullets: string[] = [];
  let open = false;
  const flush = () => {
    if (open) {
      const item = finishExperience(header, bullets);
      if (item) out.push(item);
    }
    header = [];
    bullets = [];
    open = false;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isExperienceHeader(line) || (!open && !isBullet(line))) {
      flush();
      header = [line];
      open = true;
    } else if (isBullet(line)) {
      bullets.push(stripBullet(line));
    } else if (bullets.length === 0) {
      header.push(line);
    } else {
      bullets.push(line);
    }
  }
  flush();
  return out;
}

const INST_RE = /universit|college|institute|school|academy|polytechnic/i;
const DEGREE_RE = /b\.?s|b\.?a|m\.?s|m\.?a|m\.?b\.?a|ph\.?d|bachelor|master|diploma|degree|certificate|associate/i;

function finishEducation(lines: string[]): EducationItem | null {
  const text = lines.map((l) => stripBullet(l).trim()).filter(Boolean);
  if (text.length === 0) return null;
  const joined = text.join(" • ");
  let startDate = "";
  let endDate = "";
  const rangeMatch = joined.match(DATE_RANGE_RE);
  if (rangeMatch) {
    startDate = rangeMatch[1].trim();
    endDate = /present|current/i.test(rangeMatch[2]) ? "" : rangeMatch[2].trim();
  } else {
    const yearMatch = joined.match(/\b(?:19|20)\d{2}\b/);
    if (yearMatch) endDate = yearMatch[0];
  }
  const instIdx = text.findIndex((l) => INST_RE.test(l));
  const institution = (instIdx >= 0 ? text[instIdx] : text[0]).replace(DATE_RANGE_RE, "").trim();
  const degLine = text.find((l, i) => i !== instIdx && DEGREE_RE.test(l));
  let degree = degLine ? degLine.replace(DATE_RANGE_RE, "").trim() : "";
  if (!degree && instIdx !== 0 && text[0] !== institution) {
    degree = text[0].replace(DATE_RANGE_RE, "").trim();
  }
  const usedForDegree = degLine ?? (degree ? text[0] : undefined);
  const details = text
    .filter((l, i) => i !== instIdx && l !== usedForDegree)
    .join(" ")
    .replace(DATE_RANGE_RE, "")
    .trim();
  return {
    id: uid("edu"),
    institution,
    degree,
    field: "",
    startDate,
    endDate,
    details: details || "",
  };
}

/** Line-driven education parsing: new entry starts at an institution line. */
function parseEducation(lines: string[]): EducationItem[] {
  const out: EducationItem[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) {
      const item = finishEducation(cur);
      if (item) out.push(item);
    }
    cur = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (INST_RE.test(line) && cur.length) flush();
    cur.push(line);
  }
  flush();
  return out;
}

function parseSkills(lines: string[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  const loose: string[] = [];
  for (const raw of lines) {
    const line = stripBullet(raw).trim();
    if (!line) continue;
    const catMatch = line.match(/^([A-Za-z0-9 /&+]{2,30}):\s*(.+)$/);
    if (catMatch) {
      const items = catMatch[2]
        .split(/[,;|•]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length) groups.push({ id: uid("skl"), category: catMatch[1].trim(), items });
    } else {
      loose.push(
        ...line
          .split(/[,;|•]/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  if (loose.length) {
    groups.push({ id: uid("skl"), category: "Skills", items: Array.from(new Set(loose)) });
  }
  return groups;
}

/** Line-driven projects parsing: bullets attach to the current project. */
function parseProjects(lines: string[]): ProjectItem[] {
  const out: ProjectItem[] = [];
  let header: string[] = [];
  let bullets: string[] = [];
  let open = false;
  const flush = () => {
    if (open && (header.length || bullets.length)) {
      const headerText = header.join(" — ");
      const dateMatch = headerText.match(DATE_RANGE_RE);
      const startDate = dateMatch ? dateMatch[1].trim() : "";
      const endDate = dateMatch && !/present|current/i.test(dateMatch[2]) ? dateMatch[2].trim() : "";
      const cleaned = headerText.replace(DATE_RANGE_RE, "").trim();
      const urlMatch = cleaned.match(URL_RE);
      const url = urlMatch ? urlMatch[0].replace(/[.,;]$/, "") : "";
      const name = cleaned.replace(URL_RE, "").replace(/\s+[—–|·-]\s*$/, "").trim();
      out.push({
        id: uid("prj"),
        name: name || cleaned,
        role: "",
        url,
        startDate,
        endDate,
        highlights: bullets.length ? bullets : [""],
      });
    }
    header = [];
    bullets = [];
    open = false;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isBullet(line)) {
      bullets.push(stripBullet(line));
    } else if (!open || bullets.length > 0) {
      flush();
      header = [line];
      open = true;
    } else {
      header.push(line);
    }
  }
  flush();
  return out;
}

/** Each non-empty line becomes a certification; issuer/date split heuristically. */
function parseCertifications(lines: string[]): CertificationItem[] {
  const out: CertificationItem[] = [];
  for (const raw of lines) {
    const line = stripBullet(raw).trim();
    if (!line) continue;
    let date = "";
    const dateMatch = line.match(/\b((?:19|20)\d{2})\b/);
    if (dateMatch) date = dateMatch[1];
    const noDate = line.replace(/\(?\b(?:19|20)\d{2}\b\)?/, "").replace(/[—–,|]\s*$/, "").trim();
    const parts = noDate.split(/\s+[—–|]\s+|,\s+/);
    const name = parts[0].trim();
    const issuer = parts.length > 1 ? parts.slice(1).join(", ").trim() : "";
    if (name) out.push({ id: uid("crt"), name, issuer, date, url: "" });
  }
  return out;
}

/** Main entry: raw extracted text -> structured, fact-grounded CV fragments. */
export function parseCVText(rawText: string): ParsedCV {
  const notes: string[] = [];
  const text = rawText.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  const allLines = text.split("\n");

  const basics: Partial<CVBasics> = {};

  const email = text.match(EMAIL_RE)?.[0];
  if (email) basics.email = email;
  const phone = text.match(PHONE_RE)?.[0]?.trim();
  if (phone && phone.replace(/\D/g, "").length >= 7) basics.phone = phone;
  const links = collectLinks(text);
  if (links.length) basics.links = links;

  const topLines = allLines.map((l) => l.trim()).filter(Boolean).slice(0, 6);
  const nameLine = topLines.find(looksLikeName);
  if (nameLine) {
    basics.fullName = nameLine;
    const idx = topLines.indexOf(nameLine);
    const next = topLines[idx + 1];
    if (
      next &&
      !EMAIL_RE.test(next) &&
      !PHONE_RE.test(next) &&
      next.length <= 60 &&
      !detectHeading(next)
    ) {
      basics.title = next;
    }
  } else {
    notes.push("Could not confidently detect a name — please set it manually.");
  }

  const buckets: Record<Exclude<SectionKind, "other">, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  };
  let current: Exclude<SectionKind, "other"> | null = null;
  for (const line of allLines) {
    const h = detectHeading(line);
    if (h) {
      current = h;
      continue;
    }
    if (current) buckets[current].push(line);
  }

  if (buckets.summary.length) {
    basics.summary = buckets.summary.map((l) => l.trim()).filter(Boolean).join(" ");
  }

  const experience = parseExperience(buckets.experience);
  const education = parseEducation(buckets.education);
  const skills = parseSkills(buckets.skills);
  const projects = parseProjects(buckets.projects);
  const certifications = parseCertifications(buckets.certifications);

  if (!experience.length) notes.push("No experience entries detected under an Experience heading.");
  if (!education.length) notes.push("No education entries detected under an Education heading.");
  if (!skills.length) notes.push("No skills detected under a Skills heading.");

  return { basics, experience, education, skills, projects, certifications, notes };
}
