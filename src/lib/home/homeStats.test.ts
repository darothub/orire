import { describe, expect, it } from "vitest";
import type { CvVersion } from "@/lib/store/libraryStore";
import { homeStats, recentVersions, tileInitial, timeAgo } from "./homeStats";

const v = (o: Partial<CvVersion>): CvVersion =>
  ({ id: "x", name: "CV", company: "", person: "", template: "aurora", cv: {} as never, baseline: null, createdAt: 0, updatedAt: 0, ...o }) as CvVersion;

describe("homeStats", () => {
  it("counts versions, tailored and exported", () => {
    const s = homeStats([v({ company: "Acme" }), v({ company: "  " }), v({ lastExportedAt: 5 })]);
    expect(s).toEqual({ versions: 3, tailored: 1, exported: 1 });
  });
  it("is zero for an empty library", () => {
    expect(homeStats([])).toEqual({ versions: 0, tailored: 0, exported: 0 });
  });
});

describe("recentVersions", () => {
  it("sorts newest first and caps the list without mutating input", () => {
    const input = [v({ id: "a", updatedAt: 1 }), v({ id: "b", updatedAt: 3 }), v({ id: "c", updatedAt: 2 })];
    expect(recentVersions(input, 2).map((x) => x.id)).toEqual(["b", "c"]);
    expect(input.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("timeAgo", () => {
  const now = 1_000_000_000_000;
  it("formats recent times", () => {
    expect(timeAgo(now - 10_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(timeAgo(now - 86_400_000, now)).toBe("1 day ago");
    expect(timeAgo(now - 3 * 86_400_000, now)).toBe("3 days ago");
  });
});

describe("tileInitial", () => {
  it("prefers company then name", () => {
    expect(tileInitial({ company: "acme", name: "Z" })).toBe("A");
    expect(tileInitial({ company: " ", name: "master" })).toBe("M");
  });
});
