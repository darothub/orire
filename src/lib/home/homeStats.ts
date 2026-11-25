import type { CvVersion } from "@/lib/store/libraryStore";

export interface HomeStats {
  versions: number;
  /** Versions filed under a company, i.e. tailored for a specific role. */
  tailored: number;
  exported: number;
}

export function homeStats(versions: readonly CvVersion[]): HomeStats {
  return {
    versions: versions.length,
    tailored: versions.filter((v) => v.company.trim().length > 0).length,
    exported: versions.filter((v) => !!v.lastExportedAt).length,
  };
}

/** Most recently touched first, capped for the Home list. */
export function recentVersions(versions: readonly CvVersion[], limit = 4): CvVersion[] {
  return [...versions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", else a short date. */
export function timeAgo(then: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 14) return `${d} ${d === 1 ? "day" : "days"} ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Initial for the company tile; falls back to the version name. */
export function tileInitial(v: Pick<CvVersion, "company" | "name">): string {
  const src = v.company.trim() || v.name.trim();
  return (src[0] ?? "C").toUpperCase();
}
