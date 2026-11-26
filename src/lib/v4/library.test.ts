import { describe, expect, it } from "vitest";
import type { CvVersion } from "@/lib/store/libraryStore";
import { filterCounts, filterVersions, versionTags } from "./library";

const base = { person: "Ada", baseline: null, cv: {} as CvVersion["cv"], createdAt: 1, updatedAt: 1 };
const v = (o: Partial<CvVersion> & { id: string }): CvVersion => ({ name: "CV", company: "", template: "slate", ...base, ...o });
const list = [
  v({ id: "a", name: "Senior Frontend", company: "Stripe", shareToken: "t" }),
  v({ id: "b", name: "Payments", company: "Stripe", lastExportedAt: 5 }),
  v({ id: "c", name: "Product Engineer", company: "Vercel", template: "aurora" }),
];
const tplName = (id: string) => (id === "aurora" ? "Aurora" : "Slate");

describe("versionTags", () => {
  it("marks the active version and a shared link", () => {
    expect(versionTags(list[0], "a").map((t) => t.tone)).toEqual(["active", "shared"]);
  });
  it("marks exported versions", () => {
    expect(versionTags(list[1], null).map((t) => t.tone)).toEqual(["exported"]);
  });
  it("falls back to private when nothing else applies", () => {
    expect(versionTags(list[2], null)).toEqual([{ tone: "private", label: "Private" }]);
  });
});

describe("filterVersions", () => {
  const run = (filter: Parameters<typeof filterVersions>[1]["filter"], query = "") =>
    filterVersions(list, { filter, query, activeId: "a", templateName: tplName }).map((x) => x.id);
  it("filters by status chip", () => {
    expect(run("active")).toEqual(["a"]);
    expect(run("shared")).toEqual(["a"]);
    expect(run("exported")).toEqual(["b"]);
    expect(run("all")).toEqual(["a", "b", "c"]);
  });
  it("searches name, company and template name", () => {
    expect(run("all", "stripe")).toEqual(["a", "b"]);
    expect(run("all", "PRODUCT")).toEqual(["c"]);
    expect(run("all", "aurora")).toEqual(["c"]);
    expect(run("all", "nothing")).toEqual([]);
  });
});

describe("filterCounts", () => {
  it("counts each chip over the full list", () => {
    expect(filterCounts(list, "a")).toEqual({ all: 3, active: 1, shared: 1, exported: 1 });
  });
});
