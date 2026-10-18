import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CVData } from "@/lib/cv/schema";

// Mock the server actions so cloud-mode routing can be asserted without a DB.
vi.mock("@/app/actions/library", () => ({
  listVersions: vi.fn(async () => ({ versions: [], activeId: null })),
  createVersion: vi.fn(async () => ({ ok: true, id: "srv_1" })),
  updateVersionMeta: vi.fn(async () => ({ ok: true })),
  duplicateVersion: vi.fn(async () => ({ ok: true, id: "srv_copy" })),
  deleteVersion: vi.fn(async () => ({ ok: true, activeId: null })),
  setActiveVersion: vi.fn(async () => ({ ok: true })),
  markVersionExported: vi.fn(async () => ({ ok: true })),
}));

import { useLibraryStore, groupByCompany, UNFILED, type CvVersion, type SaveVersionInput } from "./libraryStore";
import * as server from "@/app/actions/library";

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

describe("libraryStore — local mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLibraryStore.setState({ versions: [], activeId: null, lastCompany: "", cloud: false, loading: false });
  });

  it("saves a version, makes it active, remembers the company, hits no server", async () => {
    const id = await save({ company: "Stripe" });
    const s = useLibraryStore.getState();
    expect(s.versions).toHaveLength(1);
    expect(s.activeId).toBe(id);
    expect(s.lastCompany).toBe("Stripe");
    expect(s.versions[0].lastExportedAt).toBeUndefined();
    expect(server.createVersion).not.toHaveBeenCalled();
  });

  it("prepends newest first", async () => {
    await save({ name: "first" });
    await save({ name: "second" });
    expect(useLibraryStore.getState().versions.map((v) => v.name)).toEqual(["second", "first"]);
  });

  it("duplicates with a new id, (copy) suffix, not exported", async () => {
    const id = await save({ name: "Base", exported: true });
    const copyId = await useLibraryStore.getState().duplicate(id!);
    const copy = useLibraryStore.getState().versions.find((v) => v.id === copyId)!;
    expect(copyId).not.toBe(id);
    expect(copy.name).toBe("Base (copy)");
    expect(copy.lastExportedAt).toBeUndefined();
  });

  it("renames and re-files (trimmed)", async () => {
    const id = await save();
    await useLibraryStore.getState().rename(id!, "  Renamed  ");
    await useLibraryStore.getState().refile(id!, "  Globex  ");
    const v = useLibraryStore.getState().versions[0];
    expect(v.name).toBe("Renamed");
    expect(v.company).toBe("Globex");
  });

  it("removing the active version clears activeId", async () => {
    const id = await save();
    await useLibraryStore.getState().remove(id!);
    expect(useLibraryStore.getState().activeId).toBeNull();
    expect(useLibraryStore.getState().versions).toHaveLength(0);
  });

  it("recordExport with no active version files a new exported snapshot", async () => {
    useLibraryStore.setState({ activeId: null });
    await useLibraryStore.getState().recordExport({ name: "Export", company: "Acme", person: "Ada", template: "aurora", cv: cv(), baseline: null });
    const v = useLibraryStore.getState().versions[0];
    expect(v.lastExportedAt).toBeTypeOf("number");
    expect(server.markVersionExported).not.toHaveBeenCalled();
  });
});

describe("libraryStore — cloud mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLibraryStore.setState({ versions: [], activeId: null, lastCompany: "", cloud: true, loading: false });
  });

  it("saveVersion routes to createVersion then refreshes from the server", async () => {
    await save({ name: "Cloud V", company: "Stripe" });
    expect(server.createVersion).toHaveBeenCalledOnce();
    expect(server.listVersions).toHaveBeenCalled(); // refreshFromCloud
    expect(useLibraryStore.getState().cloud).toBe(true);
  });

  it("remove routes to deleteVersion", async () => {
    await useLibraryStore.getState().remove("srv_1");
    expect(server.deleteVersion).toHaveBeenCalledWith("srv_1");
  });

  it("recordExport with an active version stamps it exported, no new row", async () => {
    useLibraryStore.setState({ activeId: "srv_1" });
    await useLibraryStore.getState().recordExport({ name: "x", company: "", person: "", template: "aurora", cv: cv(), baseline: null });
    expect(server.markVersionExported).toHaveBeenCalledWith("srv_1");
    expect(server.createVersion).not.toHaveBeenCalled();
  });

  it("clear returns to local mode", () => {
    useLibraryStore.getState().clear();
    expect(useLibraryStore.getState().cloud).toBe(false);
    expect(useLibraryStore.getState().versions).toEqual([]);
  });
});

describe("libraryStore — migrateLocalToCloud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLibraryStore.setState({ versions: [], activeId: null, lastCompany: "", cloud: false, loading: false, migrationNote: null });
  });

  it("moves every local version over with makeActive: false, then enters cloud mode", async () => {
    await save({ name: "first" });
    await save({ name: "second" });
    expect(useLibraryStore.getState().cloud).toBe(false);

    await useLibraryStore.getState().migrateLocalToCloud();

    expect(server.createVersion).toHaveBeenCalledTimes(2);
    for (const call of (server.createVersion as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[0]).toMatchObject({ makeActive: false });
    }
    expect(server.listVersions).toHaveBeenCalled(); // refreshFromCloud
    expect(useLibraryStore.getState().cloud).toBe(true);
    expect(useLibraryStore.getState().migrationNote).toMatch(/moved 2 saved versions/i);
  });

  it("with nothing local, just enters cloud mode and reports nothing", async () => {
    await useLibraryStore.getState().migrateLocalToCloud();
    expect(server.createVersion).not.toHaveBeenCalled();
    expect(useLibraryStore.getState().cloud).toBe(true);
    expect(useLibraryStore.getState().migrationNote).toBeNull();
  });

  it("reports a partial count when some versions fail to migrate", async () => {
    await save({ name: "first" });
    await save({ name: "second" });
    (server.createVersion as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, id: "srv_1" })
      .mockResolvedValueOnce({ ok: false, reason: "boom" });

    await useLibraryStore.getState().migrateLocalToCloud();

    expect(useLibraryStore.getState().migrationNote).toMatch(/moved 1 of 2/i);
  });

  it("is a no-op when already in cloud mode", async () => {
    useLibraryStore.setState({ cloud: true });
    await useLibraryStore.getState().migrateLocalToCloud();
    expect(server.createVersion).not.toHaveBeenCalled();
    expect(server.listVersions).not.toHaveBeenCalled();
  });

  it("dismissMigrationNote clears the note", () => {
    useLibraryStore.setState({ migrationNote: "x" });
    useLibraryStore.getState().dismissMigrationNote();
    expect(useLibraryStore.getState().migrationNote).toBeNull();
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
    const groups = groupByCompany([mk("Acme", 10), mk("", 50), mk("Acme", 30), mk("Globex", 20)]);
    expect(groups.map((g) => g.company)).toEqual(["Acme", "Globex", UNFILED]);
    expect(groups[0].items.map((i) => i.updatedAt)).toEqual([30, 10]);
  });
});
