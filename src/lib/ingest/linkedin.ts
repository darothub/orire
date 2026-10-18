/**
 * orire — LinkedIn "Download your data" ZIP parser.
 *
 * LinkedIn's export is a zip of CSVs (for example Profile.csv, Experience.csv,
 * Education.csv, Skills.csv, Certifications.csv, Projects.csv). We map those
 * CSVs back into Orire's ParsedCV shape so the existing review/import flow can
 * consume them without a separate onboarding UX.
 */

import JSZip from "jszip";
import type { ParsedCV } from "./parse";
import { uid } from "@/lib/cv/schema";

const PROFILE_NAMES = [
  "profile",
  "profile details",
  "profile-details",
  "profiledetail",
  "profileinfo",
];

const EXPERIENCE_NAMES = [
  "experience",
  "positions",
  "position",
  "workexperience",
  "employmenthistory",
];

const EDUCATION_NAMES = ["education", "educations"];
const SKILL_NAMES = ["skills", "skill"];
const PROJECT_NAMES = ["projects", "project"];
const CERTIFICATION_NAMES = ["certifications", "certification", "licenses", "licensesandcertifications"];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "").trim();
}

function pickValue(record: Record<string, string>, aliases: string[]): string {
  const keys = Object.keys(record);
  for (const alias of aliases) {
    const match = keys.find((k) => normalizeName(k) === normalizeName(alias));
    if (match) {
      const value = record[match]?.trim() ?? "";
      if (value) return value;
    }
  }
  for (const [key, val] of Object.entries(record)) {
    if (typeof val !== "string") continue;
    const keyNorm = normalizeName(key);
    for (const alias of aliases) {
      if (keyNorm.includes(normalizeName(alias))) return val.trim();
    }
  }
  return "";
}

function splitCsvLine(raw: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (current.length || out.length) {
        out.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current.length || out.length) out.push(current);
  return out;
}

function csvRows(text: string): string[][] {
  const lines: string[][] = [];
  const rows = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (const row of rows) {
    lines.push(splitCsvLine(row).map((v) => v.trim().replace(/^"|"$/g, "")));
  }
  return lines.filter((row) => row.some((cell) => cell.length > 0));
}

function readCsvRecords(text: string): Record<string, string>[] {
  const rows = csvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const record: Record<string, string> = {};
    const values = rows[i];
    for (let j = 0; j < headers.length; j += 1) {
      const key = headers[j] ?? `column_${j + 1}`;
      record[key] = values[j] ?? "";
    }
    if (Object.values(record).some((v) => v.trim().length > 0)) out.push(record);
  }
  return out;
}

function normalizeBasicText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s*[:;]\s*$/g, "")
    .trim();
}

function splitHighlights(value: string): string[] {
  if (!value) return [];
  return value
    .split(/\n|\r|•|▪|·|;(?=\s*[A-Z])|\s{2,}/)
    .map((part) => normalizeBasicText(part))
    .filter((part) => part.length > 0)
    .slice(0, 12);
}

function parseProfile(csvText: string): ParsedCV["basics"] {
  const rows = readCsvRecords(csvText);
  const rec = rows[0] ?? {};
  const firstName = pickValue(rec, ["first name", "firstName", "firstname"]);
  const lastName = pickValue(rec, ["last name", "lastName", "lastname"]);
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || pickValue(rec, ["full name", "fullName", "name"]);
  return {
    fullName,
    title: pickValue(rec, ["headline", "title", "occupation", "professional headline"]) || "",
    email: pickValue(rec, ["email address", "email", "emailAddress", "emails"]) || "",
    phone: pickValue(rec, ["phone numbers", "phone", "phoneNumber", "mobile"]) || "",
    location: pickValue(rec, ["location", "geo location", "city", "country/region"]) || "",
    summary: pickValue(rec, ["summary", "about", "profile", "bio"]) || "",
    links: (() => {
      const raw = pickValue(rec, ["profile url", "url", "website", "linked in profile url", "linkedin profile url"]);
      if (!raw) return [];
      return [{ id: uid("lnk"), label: raw.toLowerCase().includes("linkedin") ? "LinkedIn" : "Website", url: raw }];
    })(),
  };
}

function parseExperience(rows: Record<string, string>[]): ParsedCV["experience"] {
  const out: ParsedCV["experience"] = [];
  for (const row of rows) {
    const company = pickValue(row, ["company name", "company", "organization", "employer"]);
    const role = pickValue(row, ["title", "role", "position", "job title"]);
    const description = pickValue(row, ["description", "summary", "role description", "details"]);
    if (!company && !role) continue;
    const startDate = pickValue(row, ["start date", "from", "started at", "date started"]);
    const endDate = pickValue(row, ["end date", "to", "ended at", "date ended"]);
    const current = /yes|true|current|present/i.test(pickValue(row, ["currently working", "is current role", "currently employed", "end date"])) || /current|present/i.test(endDate ?? "");
    out.push({
      id: uid("exp"),
      company: company || "",
      role: role || "",
      location: pickValue(row, ["location", "geo location"]) || "",
      startDate: startDate || "",
      endDate: current ? "" : endDate || "",
      current,
      highlights: splitHighlights(description),
    });
  }
  return out;
}

function parseEducation(rows: Record<string, string>[]): ParsedCV["education"] {
  const out: ParsedCV["education"] = [];
  for (const row of rows) {
    const institution = pickValue(row, ["school name", "institution", "school", "organization"]);
    const degree = pickValue(row, ["degree name", "degree", "degree name", "field of study"]);
    const field = pickValue(row, ["field of study", "major", "discipline"]);
    const details = pickValue(row, ["notes", "description", "activities"]);
    if (!institution && !degree) continue;
    const startDate = pickValue(row, ["start date", "from", "date started"]);
    const endDate = pickValue(row, ["end date", "to", "date ended"]);
    out.push({
      id: uid("edu"),
      institution: institution || "",
      degree: degree || "",
      field: field || "",
      startDate: startDate || "",
      endDate: endDate || "",
      details: details || "",
    });
  }
  return out;
}

function parseSkills(rows: Record<string, string>[]): ParsedCV["skills"] {
  const items = new Set<string>();
  for (const row of rows) {
    const names = [
      pickValue(row, ["skill", "name", "skills", "technology"]),
      pickValue(row, ["skill name", "skill name", "competency"]),
    ].filter(Boolean);
    for (const value of names) {
      for (const part of value.split(/[,;|/]/)) {
        const clean = normalizeBasicText(part);
        if (clean) items.add(clean);
      }
    }
  }
  return items.size > 0 ? [{ id: uid("grp"), category: "Core Skills", items: [...items] }] : [];
}

function parseProjects(rows: Record<string, string>[]): ParsedCV["projects"] {
  const out: ParsedCV["projects"] = [];
  for (const row of rows) {
    const name = pickValue(row, ["title", "project", "name", "project name"]);
    const description = pickValue(row, ["description", "notes", "summary"]);
    if (!name && !description) continue;
    out.push({
      id: uid("prj"),
      name: name || "Project",
      url: pickValue(row, ["url", "project url", "website"]) || "",
      startDate: pickValue(row, ["start date", "from"]) || "",
      endDate: pickValue(row, ["end date", "to"]) || "",
      highlights: splitHighlights(description),
    });
  }
  return out;
}

function parseCerts(rows: Record<string, string>[]): ParsedCV["certifications"] {
  const out: ParsedCV["certifications"] = [];
  for (const row of rows) {
    const name = pickValue(row, ["name", "certification name", "license name", "certificate"]);
    const issuer = pickValue(row, ["authority", "issuer", "organization", "company"]);
    if (!name && !issuer) continue;
    out.push({
      id: uid("cert"),
      name: name || "Certification",
      issuer: issuer || "",
      date: pickValue(row, ["start date", "date", "issue date"]) || "",
    });
  }
  return out;
}

export function fileLookup(csvMap: Map<string, string>, aliases: string[]): string | undefined {
  const normalized = new Map<string, string>();
  for (const [name, text] of csvMap.entries()) {
    normalized.set(normalizeName(name), text);
  }
  for (const alias of aliases) {
    const found = normalized.get(normalizeName(alias));
    if (found) return found;
  }
  return undefined;
}

export async function parseLinkedInZip(buffer: ArrayBuffer): Promise<ParsedCV | null> {
  const zip = await JSZip.loadAsync(buffer);
  const csvMap = new Map<string, string>();
  for (const name of Object.keys(zip.files)) {
    const file = zip.files[name];
    if (file.dir || !name.toLowerCase().endsWith(".csv")) continue;
    csvMap.set(name.toLowerCase(), await file.async("string"));
  }
  if (csvMap.size === 0) return null;

  const profileText = fileLookup(csvMap, PROFILE_NAMES) ?? fileLookup(csvMap, ["profile", "profiledetails"]);
  const expText = fileLookup(csvMap, EXPERIENCE_NAMES) ?? fileLookup(csvMap, ["position", "positions"]);
  const eduText = fileLookup(csvMap, EDUCATION_NAMES);
  const skillText = fileLookup(csvMap, SKILL_NAMES);
  const projectText = fileLookup(csvMap, PROJECT_NAMES);
  const certText = fileLookup(csvMap, CERTIFICATION_NAMES);

  const parsed: ParsedCV = {
    basics: profileText ? parseProfile(profileText) : {},
    experience: expText ? parseExperience(readCsvRecords(expText)) : [],
    education: eduText ? parseEducation(readCsvRecords(eduText)) : [],
    skills: skillText ? parseSkills(readCsvRecords(skillText)) : [],
    projects: projectText ? parseProjects(readCsvRecords(projectText)) : [],
    certifications: certText ? parseCerts(readCsvRecords(certText)) : [],
    notes: [],
  };

  if (!parsed.basics.fullName && parsed.experience.length === 0 && parsed.education.length === 0) {
    return null;
  }

  const notes: string[] = [];
  if (!parsed.basics.fullName) notes.push("LinkedIn export had no readable name.");
  if (parsed.experience.length === 0) notes.push("LinkedIn export did not include any role history.");
  if (parsed.education.length === 0) notes.push("LinkedIn export did not include any education history.");
  parsed.notes = notes;
  return parsed;
}
