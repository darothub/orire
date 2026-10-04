/**
 * orire — cover letter companion (CL-1).
 *
 * An optional, AI-generated cover letter tailored to a job description. Like
 * the CV itself, it is strictly fact-grounded: the model may only restructure
 * and phrase facts that already exist in the candidate's CV — never invent
 * employers, dates, metrics, or credentials.
 *
 * The structured shape (rather than a single blob of prose) keeps the letter
 * editable and template-matchable in later phases (CL-2/CL-3).
 */

export interface CoverLetterMeta {
  /** Role the letter is addressed to (pulled from the JD). */
  role: string;
  /** Hiring company (pulled from the JD, best-effort). */
  company: string;
  /** Named addressee if the JD provides one, else undefined. */
  hiringManager?: string;
}

export interface CoverLetter {
  meta: CoverLetterMeta;
  /** Greeting-adjacent hook paragraph. */
  opening: string;
  /** 2–4 body paragraphs. */
  body: string[];
  /** Closing paragraph (call to action / thanks). */
  closing: string;
  /** Sign-off line, e.g. "Sincerely,". */
  signoff: string;
}

/** An empty letter, useful as a default / reset value. */
export function emptyCoverLetter(): CoverLetter {
  return {
    meta: { role: "", company: "", hiringManager: undefined },
    opening: "",
    body: [],
    closing: "",
    signoff: "Sincerely,",
  };
}

/**
 * Flatten a cover letter to readable plain text. Used both for the invisible,
 * extractable text layer in the exported PDF and anywhere a copy-paste version
 * is handy. `sender` is the candidate's name (from the CV) for the signature.
 */
export function coverLetterToText(letter: CoverLetter, sender: string, title = "", contact = ""): string {
  const lines: string[] = [];
  if (sender.trim()) lines.push(sender.trim());
  if (title.trim()) lines.push(title.trim());
  if (contact.trim()) lines.push(contact.trim());
  if (lines.length) lines.push("");

  const to = [letter.meta.company, letter.meta.role ? `Re: ${letter.meta.role}` : ""]
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length) {
    lines.push(...to, "");
  }

  lines.push(letter.meta.hiringManager?.trim() ? `Dear ${letter.meta.hiringManager.trim()},` : "Dear Hiring Team,", "");
  if (letter.opening.trim()) lines.push(letter.opening.trim(), "");
  for (const p of letter.body) {
    if (p.trim()) lines.push(p.trim(), "");
  }
  if (letter.closing.trim()) lines.push(letter.closing.trim(), "");
  lines.push(letter.signoff.trim() || "Sincerely,", sender.trim() || "");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
