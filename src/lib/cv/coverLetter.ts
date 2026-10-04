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
