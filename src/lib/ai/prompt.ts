/**
 * orire — prompt construction for job-description refinement.
 *
 * Fact-grounding is enforced twice: (1) here, by instructing the model to only
 * restructure facts already present in the source CV; and (2) deterministically
 * after the model responds, in guardrails.ts. The prompt alone is never trusted.
 */

import type { CVData } from "@/lib/cv/schema";

const SCHEMA_HINT = `Return ONLY a JSON object with exactly this shape (no markdown, no prose):
{
  "basics": {
    "fullName": string, "title": string, "email": string, "phone": string,
    "location": string, "summary": string,
    "links": [{ "label": string, "url": string }]
  },
  "experience": [{
    "company": string, "role": string, "location": string,
    "startDate": string, "endDate": string, "current": boolean,
    "highlights": [string]
  }],
  "education": [{
    "institution": string, "degree": string, "field": string,
    "startDate": string, "endDate": string, "details": string
  }],
  "skills": [{ "category": string, "items": [string] }],
  "projects": [{
    "name": string, "role": string, "url": string,
    "startDate": string, "endDate": string, "highlights": [string]
  }],
  "certifications": [{ "name": string, "issuer": string, "date": string, "url": string }]
}`;

export const SYSTEM_PROMPT = `You are a meticulous CV editor. You tailor an existing CV to a target job description.

ABSOLUTE RULES (fact-grounding):
- Use ONLY facts that already appear in the provided source CV. This is the single source of truth.
- NEVER invent, add, or alter: employers, job titles you did not hold, dates, locations, degrees, institutions, certifications, project names, employers, metrics, or numbers.
- NEVER add skills the person did not list.
- You MAY: reorder items, rephrase for clarity and impact, emphasise the most relevant experience, trim less-relevant detail, and write a tailored professional summary — but only from facts already present.
- TERMINOLOGY MATCHING: when the source CV and the job description refer to the SAME skill or technology using different words (e.g. source says "JS", the job says "JavaScript"), prefer the job description's wording so the CV mirrors the role — but ONLY when the underlying fact is genuinely present in the source. Never introduce a skill or tool the person does not already have.
- Surface the candidate's most job-relevant existing skills, experience, and keywords prominently (in the summary and highlights) so a reader immediately sees the fit — without inventing anything.
- Keep the person's name, email, and phone EXACTLY as provided.
- If the source lacks something the job wants, do NOT fabricate it. Simply omit it.
- Output must be valid JSON only, matching the given schema. No commentary.`;

export function buildUserPrompt(cv: CVData, jobDescription: string): string {
  return [
    "SOURCE CV (the only allowed source of facts):",
    "```json",
    JSON.stringify(cv, null, 2),
    "```",
    "",
    "TARGET JOB DESCRIPTION:",
    "```",
    jobDescription.trim(),
    "```",
    "",
    "Rewrite and reorder the CV to best match the job description, obeying every fact-grounding rule.",
    SCHEMA_HINT,
  ].join("\n");
}

export const STRUCTURE_SYSTEM = `You convert the raw text of a CV/résumé into structured JSON.

ABSOLUTE RULES (fact-grounding):
- Use ONLY information that literally appears in the provided text. The text is the single source of truth.
- NEVER invent, add, guess, or infer: names, employers, titles, dates, locations, degrees, institutions, skills, certifications, metrics, or contact details.
- Do NOT translate, embellish, summarise beyond what is written, or add proficiency levels.
- Preserve the person's name, email, and phone EXACTLY as written.
- Keep each distinct bullet/achievement as its own "highlights" entry, verbatim (you may only strip leading bullet glyphs and surrounding whitespace).
- Assign each experience/education/project/skill line to the correct field. If you cannot confidently classify something, omit it rather than guess.
- If a field is absent from the text, use an empty string "" (or an empty array). Never fill it with a placeholder.
- Output MUST be valid JSON only, matching the given schema. No markdown, no commentary.`;

export function buildStructurePrompt(rawText: string): string {
  return [
    "RAW CV TEXT (the only allowed source of facts):",
    "```",
    rawText.trim(),
    "```",
    "",
    "Extract the information above into structured JSON, obeying every fact-grounding rule.",
    SCHEMA_HINT,
  ].join("\n");
}

/* ------------------------------------------------------------------ *
 * Patch-mode refine (token-lean).
 *
 * Rather than re-emitting the entire CV (identity, dates, URLs, etc. — all of
 * which the deterministic guardrails LOCK to the source anyway), we ask the
 * model to return ONLY the tailorable content, referencing source experience
 * and projects by index. This roughly halves output tokens with no loss of
 * grounding: applyRefinePatch reconstructs a full candidate from source + patch
 * and the same factGround pass runs over it unchanged.
 * ------------------------------------------------------------------ */

export const PATCH_SYSTEM = `You are a meticulous CV editor. You tailor an existing CV to a target job description.

You will receive the SOURCE CV with each experience and project pre-numbered like [#0], [#1].
Return ONLY a compact JSON "patch" of the content you want to CHANGE — never the whole CV.

ABSOLUTE RULES (fact-grounding):
- Use ONLY facts already in the source CV. NEVER invent or alter employers, titles you did not hold, dates, locations, degrees, institutions, certifications, project names, metrics, or numbers, and NEVER add skills the person did not list.
- You MAY: reorder items, rephrase highlights for clarity/impact, emphasise the most relevant experience, trim less-relevant highlights, and write a tailored summary — but only from facts already present.
- TERMINOLOGY MATCHING: when source and job description name the SAME existing skill/tech differently, prefer the job's wording — but only when the fact is genuinely present.
- Reference each experience/project by its source index ("ref"). Do not emit company names, dates, emails, phone, or URLs — those are carried from the source automatically.
- Output MUST be valid JSON only (no markdown, no prose), matching the patch schema.`;

export const PATCH_SCHEMA_HINT = `Return ONLY this JSON shape (omit any field you don't want to change):
{
  "title": string,                 // tailored headline (optional)
  "summary": string,               // tailored professional summary (optional)
  "order": [number],               // source experience indices in the new display order (optional)
  "experience": [                  // one entry per source experience you keep, by ref
    { "ref": number, "role": string, "highlights": [string] }
  ],
  "projects": [
    { "ref": number, "role": string, "highlights": [string] }
  ],
  "skills": [                      // reorder/regroup EXISTING skills only
    { "category": string, "items": [string] }
  ]
}`;

export function indexedSource(cv: CVData): string {
  const exp = cv.experience
    .map((e, i) => {
      const when = [e.startDate, e.endDate].filter(Boolean).join("–");
      const head = `[#${i}] ${e.role || "—"} @ ${e.company || "—"}${when ? ` (${when})` : ""}`;
      const bullets = (e.highlights ?? []).map((h) => `    - ${h}`).join("\n");
      return bullets ? `${head}\n${bullets}` : head;
    })
    .join("\n");
  const prj = cv.projects
    .map((p, i) => {
      const bullets = (p.highlights ?? []).map((h) => `    - ${h}`).join("\n");
      const head = `[#${i}] ${p.name || "—"}${p.role ? ` — ${p.role}` : ""}`;
      return bullets ? `${head}\n${bullets}` : head;
    })
    .join("\n");
  const skills = cv.skills
    .map((g) => `- ${g.category || "Skills"}: ${g.items.join(", ")}`)
    .join("\n");
  return [
    `NAME: ${cv.basics.fullName}`,
    cv.basics.title ? `CURRENT TITLE: ${cv.basics.title}` : "",
    cv.basics.summary ? `CURRENT SUMMARY: ${cv.basics.summary}` : "",
    "",
    "EXPERIENCE (reference by [#index]):",
    exp || "(none)",
    "",
    prj ? "PROJECTS (reference by [#index]):" : "",
    prj,
    "",
    skills ? "SKILLS (reorder/regroup existing only):" : "",
    skills,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function buildPatchPrompt(cv: CVData, jobDescription: string): string {
  return [
    "SOURCE CV (the only allowed source of facts):",
    indexedSource(cv),
    "",
    "TARGET JOB DESCRIPTION:",
    "```",
    jobDescription.trim(),
    "```",
    "",
    "Produce the tailoring patch. Reorder and rephrase to best match the job, obeying every fact-grounding rule.",
    PATCH_SCHEMA_HINT,
  ].join("\n");
}
