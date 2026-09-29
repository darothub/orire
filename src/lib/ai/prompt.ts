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
