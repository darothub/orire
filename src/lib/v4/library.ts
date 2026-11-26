import type { CvVersion } from "@/lib/store/libraryStore";

export type LibraryFilter = "all" | "active" | "shared" | "exported";

export const LIBRARY_FILTERS: readonly { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "shared", label: "Shared" },
  { id: "exported", label: "Exported" },
];

export type VersionTagTone = "active" | "shared" | "exported" | "private";
export interface VersionTag { tone: VersionTagTone; label: string }

/** The status tags shown on a version card, in display order. */
export function versionTags(v: Pick<CvVersion, "id" | "shareToken" | "lastExportedAt">, activeId: string | null): VersionTag[] {
  const tags: VersionTag[] = [];
  if (v.id === activeId) tags.push({ tone: "active", label: "Active" });
  if (v.shareToken) tags.push({ tone: "shared", label: "Shared link on" });
  if (v.lastExportedAt) tags.push({ tone: "exported", label: "Exported" });
  if (!v.shareToken && !v.lastExportedAt) tags.push({ tone: "private", label: "Private" });
  return tags;
}

function matchesFilter(v: CvVersion, filter: LibraryFilter, activeId: string | null): boolean {
  switch (filter) {
    case "active": return v.id === activeId;
    case "shared": return !!v.shareToken;
    case "exported": return !!v.lastExportedAt;
    default: return true;
  }
}

/** Filter by status chip and a free-text query over name, company and template. */
export function filterVersions(
  versions: CvVersion[],
  opts: { filter: LibraryFilter; query: string; activeId: string | null; templateName: (id: string) => string },
): CvVersion[] {
  const q = opts.query.trim().toLowerCase();
  return versions.filter((v) => {
    if (!matchesFilter(v, opts.filter, opts.activeId)) return false;
    if (!q) return true;
    return [v.name, v.company, opts.templateName(v.template)].some((s) => s.toLowerCase().includes(q));
  });
}

/** Counts for the filter chips, computed over the unfiltered list. */
export function filterCounts(versions: CvVersion[], activeId: string | null): Record<LibraryFilter, number> {
  const count = (f: LibraryFilter) => versions.filter((v) => matchesFilter(v, f, activeId)).length;
  return { all: versions.length, active: count("active"), shared: count("shared"), exported: count("exported") };
}
