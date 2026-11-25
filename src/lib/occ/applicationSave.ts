/**
 * orire — OCC application tracking validation. Transcript-style: only the
 * fields the board needs (company, role, status, link, notes, optional linked
 * CV version id). No CV/JD content is stored.
 */

export const APPLICATION_STATUSES = ["saved", "applied", "interview", "offer"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
};

export type OccApplicationInput = {
  company: string;
  role: string;
  status: ApplicationStatus;
  link: string | null;
  notes: string;
  documentId: string | null;
};

const isStatus = (v: unknown): v is ApplicationStatus =>
  typeof v === "string" && (APPLICATION_STATUSES as readonly string[]).includes(v);

export function validateApplicationInput(input: unknown): OccApplicationInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const x = input as Record<string, unknown>;
  const company = typeof x.company === "string" ? x.company.trim() : "";
  if (!company || company.length > 120) return null;
  return {
    company,
    role: typeof x.role === "string" ? x.role.trim().slice(0, 120) : "",
    status: isStatus(x.status) ? x.status : "saved",
    link: typeof x.link === "string" && x.link.trim() ? x.link.trim().slice(0, 500) : null,
    notes: typeof x.notes === "string" ? x.notes.slice(0, 2000) : "",
    documentId: typeof x.documentId === "string" && x.documentId.trim() ? x.documentId.trim().slice(0, 100) : null,
  };
}

export function validateApplicationStatus(v: unknown): ApplicationStatus | null {
  return isStatus(v) ? v : null;
}
