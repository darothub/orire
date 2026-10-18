import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

const memory = new MemoryStorage();

beforeAll(() => {
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: memory },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: memory,
    configurable: true,
  });
});

function realCv(name: string, email = `${name.replace(/\s+/g, ".").toLowerCase()}@mail.test`) {
  return {
    basics: {
      fullName: name,
      title: "Engineer",
      email,
      phone: "",
      location: "",
      summary: "Real work",
      links: [],
    },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };
}

const { cvStore, libraryStore, targetStore, planStore } = vi.hoisted(() => {
  const sample = {
    basics: {
      fullName: "Sample",
      title: "Engineer",
      email: "ada@example.com",
      phone: "",
      location: "",
      summary: "",
      links: [] as [],
    },
    experience: [] as [],
    education: [] as [],
    skills: [] as [],
    projects: [] as [],
    certifications: [] as [],
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };

  function makePersistStoreHoisted<T extends object>(initial: T, name: string) {
    let state = { ...initial };
    let persistName = name;
    const storage = () => globalThis.localStorage;
    return {
      getState: () => state as T,
      setState: (partial: Partial<T>) => {
        state = { ...state, ...partial };
        try {
          storage()?.setItem(persistName, JSON.stringify({ state }));
        } catch {
          /* ignore */
        }
      },
      persist: {
        getOptions: () => ({ name: persistName }),
        setOptions: (o: { name?: string }) => {
          if (o.name) persistName = o.name;
        },
        rehydrate: async () => {
          const raw = storage()?.getItem(persistName) ?? null;
          if (!raw) {
            state = { ...initial };
            return;
          }
          try {
            const parsed = JSON.parse(raw) as { state?: T };
            if (parsed?.state) state = { ...initial, ...parsed.state };
            else state = { ...initial };
          } catch {
            state = { ...initial };
          }
        },
      },
    };
  }

  const cvStore = makePersistStoreHoisted(
    {
      cv: sample,
      activeTemplate: "aurora",
      baseline: null as null,
      started: false,
      ignoredSkills: [] as string[],
    },
    "orire-cv:anon:v1",
  );

  const libraryStore = makePersistStoreHoisted(
    {
      versions: [] as { id: string }[],
      activeId: null as string | null,
      lastCompany: "",
      cloud: false,
    },
    "orire-library:anon:v1",
  );

  const targetStore = makePersistStoreHoisted(
    {
      ideal: null as unknown,
      jd: "",
      label: "",
      createdAt: null as number | null,
      baseScore: 0,
    },
    "orire-target:anon:v1",
  );

  const planInner = makePersistStoreHoisted(
    {
      plan: "free",
      usageMonth: "2026-04",
      refinesUsed: 0,
      serverActive: false,
      serverUsed: 0,
    },
    "orire-plan:anon:v1",
  );

  const planStore = {
    ...planInner,
    getState: () => ({
      ...planInner.getState(),
      clearServer: () => {
        planInner.setState({ serverActive: false, serverUsed: 0, plan: "free" });
      },
    }),
    setState: planInner.setState,
    persist: planInner.persist,
  };

  return { cvStore, libraryStore, targetStore, planStore };
});

vi.mock("@/lib/cv/sample", () => ({
  isSampleCV: (cv: { basics?: { email?: string } }) =>
    (cv?.basics?.email ?? "").includes("@example.com"),
}));

vi.mock("./cvStore", () => ({ useCVStore: cvStore }));
vi.mock("./libraryStore", () => ({ useLibraryStore: libraryStore }));
vi.mock("./targetStore", () => ({ useTargetStore: targetStore }));
vi.mock("./planStore", () => ({ usePlanStore: planStore }));

import {
  __resetStorageScopeForTests,
  applyStorageScope,
  getStorageScopeState,
} from "./applyStorageScope";
import { scopedNameFor } from "./storageScope";

describe("applyStorageScope", () => {
  beforeEach(async () => {
    memory.clear();
    __resetStorageScopeForTests();
    cvStore.persist.setOptions({ name: scopedNameFor("cv", null) });
    libraryStore.persist.setOptions({ name: scopedNameFor("library", null) });
    targetStore.persist.setOptions({ name: scopedNameFor("target", null) });
    planStore.persist.setOptions({ name: scopedNameFor("plan", null) });
    await applyStorageScope(null);
    cvStore.setState({
      cv: realCv("Guest"),
      activeTemplate: "aurora",
      baseline: null,
      started: true,
      ignoredSkills: [],
    });
    libraryStore.setState({ versions: [], activeId: null, lastCompany: "", cloud: false });
    targetStore.setState({ ideal: null, jd: "", label: "", createdAt: null, baseScore: 0 });
    planStore.setState({
      plan: "free",
      usageMonth: "2026-04",
      refinesUsed: 0,
      serverActive: false,
      serverUsed: 0,
    });
  });

  it("binds anonymous keys by default", async () => {
    await applyStorageScope(null);
    const s = getStorageScopeState();
    expect(s.ready).toBe(true);
    expect(s.userId).toBeNull();
    expect(cvStore.persist.getOptions().name).toBe(scopedNameFor("cv", null));
    expect(libraryStore.persist.getOptions().name).toBe(scopedNameFor("library", null));
  });

  it("migrates legacy unscoped keys into anon once", async () => {
    memory.clear();
    __resetStorageScopeForTests();
    memory.setItem(
      "orire-cv-v1",
      JSON.stringify({
        state: {
          cv: realCv("Legacy"),
          activeTemplate: "nova",
          baseline: null,
          started: true,
          ignoredSkills: [],
        },
        version: 2,
      }),
    );
    await applyStorageScope(null);
    expect(memory.getItem("orire-cv-v1")).toBeNull();
    expect(memory.getItem(scopedNameFor("cv", null))).toBeTruthy();
  });

  it("preserves guest CV when signing into an empty user bucket", async () => {
    cvStore.setState({
      cv: realCv("Guest Work"),
      activeTemplate: "slate",
      baseline: null,
      started: true,
      ignoredSkills: [],
    });
    await applyStorageScope("user_a");
    expect(getStorageScopeState().userId).toBe("user_a");
    expect(cvStore.persist.getOptions().name).toBe(scopedNameFor("cv", "user_a"));
    expect(cvStore.getState().cv.basics.fullName).toBe("Guest Work");
    expect(cvStore.getState().started).toBe(true);
  });

  it("loads existing user payload instead of overwriting with guest work", async () => {
    const userKey = scopedNameFor("cv", "user_b");
    memory.setItem(
      userKey,
      JSON.stringify({
        state: {
          cv: realCv("Account B"),
          activeTemplate: "aurora",
          baseline: null,
          started: true,
          ignoredSkills: [],
        },
        version: 2,
      }),
    );
    cvStore.setState({
      cv: realCv("Guest Should Not Win"),
      activeTemplate: "slate",
      baseline: null,
      started: true,
      ignoredSkills: [],
    });
    await applyStorageScope("user_b");
    expect(cvStore.getState().cv.basics.fullName).toBe("Account B");
  });

  it("keeps separate buckets for two accounts", async () => {
    cvStore.setState({
      cv: realCv("Alice"),
      activeTemplate: "aurora",
      baseline: null,
      started: true,
      ignoredSkills: [],
    });
    await applyStorageScope("alice");
    cvStore.setState({
      cv: realCv("Alice Saved"),
      activeTemplate: "aurora",
      baseline: null,
      started: true,
      ignoredSkills: [],
    });
    await applyStorageScope("bob");
    expect(cvStore.persist.getOptions().name).toBe(scopedNameFor("cv", "bob"));
    expect(cvStore.getState().cv.basics.email).toContain("@example.com");
    await applyStorageScope("alice");
    expect(cvStore.getState().cv.basics.fullName).toBe("Alice Saved");
  });
});
