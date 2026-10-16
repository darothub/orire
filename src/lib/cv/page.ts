/** How a CV is laid out for export/print. Shared by the PDF/print pipeline and
 *  the export UI — kept separate from any store so it has no client-only deps. */
export type PageMode = "continuous" | "paged" | "fit";

export const PAGE_MODES: { id: PageMode; label: string; hint: string }[] = [
  { id: "continuous", label: "Whole length", hint: "One tall page — never breaks an entry" },
  { id: "paged", label: "Break into pages", hint: "Flow across A4 pages" },
  { id: "fit", label: "Fit to one page", hint: "Scale down to a single A4 page" },
];
