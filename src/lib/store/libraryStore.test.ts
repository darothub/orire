import { describe, it, expect, beforeEach } from "vitest";
import { useLibraryStore, groupByCompany, UNFILED, type CvVersion, type SaveVersionInput } from "./libraryStore";
import type { CVData } from "@/lib/cv/schema";

function cv(name = "Ada"): CVData {
  return {
    basics: { fullName: name, title: "Engineer", email: "", phone: "", location: "", summary: "", links: [] },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };
}

const save = (over: Partial<SaveVersionInput> = {}) =>
  useLibraryStore.getState().saveVersion({
    name: "V",
    company: "Acme",
    person: "Ada",
    template: "aurora",
    cv: cv(),
    baseline: null,
    ...over,
  });

describe("libraryStore", () => {
  beforeEach(() => useLibraryStore.setState({ versions: [], activeId: null, lastCompany: "" }));

  it("saves a version, makes it active, and remembers the company", () => {
    const id = save({ company: "Stripe" });
    const s = useLibraryStore.getState();
    expect(s.versions).toHaveLength(1);
    expect(s.activeId).toBe(id);
    expect(s.lastCompany).toBe("Stripe");
    expect(s.versions[0].lastExportedAt).toBeUndefined(); // not exported unless flagged
  });

  it("marks exported versions with a timestamp", () => {
    save({ exported: true });
    expect(useLibraryStore.getState().versions[0].lastExportedAt).toBeTypeOf("number");
  });

  it("prepends newest first", () => {
    save({ name: "first" });
    save({ name: "second" });
    expect(useLibraryStore.getState().versions.map((v) => v.name)).toEqual(["second", "first"]);
  });

  it("duplicates a version with a new id and (copy) suffix, not exported", () => {
    const id = save({ name: "Base", exported: true });
    const copyId = useLibraryStore.getState().duplicate(id);
    const s = useLibraryStore.getState();
    expect(copyId).not.toBe(id);
    expect(s.versions).toHaveLength(2);
    const copy = s.versions.find((v) => v.id === copyId)!;
    expect(copy.name).toBe("Base (copy)");
    expect(copy.lastExportedAt).toBeUndefined();
  });

  it("renames and re-files", () => {
    const id = save();
    useLibraryStore.getState().rename(id, "  Renamed  ");
    useLibraryStore.getState().refile(id, "  Globex  ");
    const v = useLibraryStore.getState().versions[0];
    expect(v.name).toBe("Renamed");
    expect(v.company).toBe("Globex");
  });

  it("removing the active version clears activeId", () => {
    const id = save();
    expect(useLibraryStore.getState().activeId).toBe(id);
    useLibraryStore.getState().remove(id);
    expect(useLibraryStore.getState().activeId).toBeNull();
    expect(useLibraryStore.getState().versions).toHaveLength(0);
  });
});

describe("groupByCompany", () => {
  const mk = (company: string, updatedAt: number): CvVersion => ({
    id: `${company}-${updatedAt}`,
    name: company,
    company,
    person: "",
    template: "aurora",
    cv: cv(),
    baseline: null,
    createdAt: updatedAt,
    updatedAt,
  });

  it("groups by company, newest-updated first within a group, Unfiled last", () => {
    const groups = groupByCompany([
      mk("Acme", 10),
      mk("", 50), // Unfiled, most recent overall
      mk("Acme", 30),
      mk("Globex", 20),
    ]);
    expect(groups.map((g) => g.company)).toEqual(["Acme", "Globex", UNFILED]);
    expect(groups[0].items.map((i) => i.updatedAt)).toEqual([30, 10]);
  });
});
