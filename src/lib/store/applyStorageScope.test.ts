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

type LooseCv = {
  basics: {
    fullName: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
    links: unknown[];
  };
  experience: unknown[];
  education: unknown[];
  skills: unknown[];
  projects: unknown[];
  certifications: unknown[];
  order: string[];
};

type CvBucket = {
  cv: LooseCv;
  activeTemplate: string;
  baseline: null;
  started: boolean;
  ignoredSkills: string[];
};

const { cvStore, libraryStore, targetStore, planStore } = vi.hoisted(() => {
  const sample: LooseCv = {
    basics: {
      fullName: "Sample",
      title: "Engineer",
      email: "ada@example.com",
      phone: "",
      location: "",
      summary: "",
      links: [],
    },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };

  /**
   * Mimic real zustand persist: empty-key rehydrate does NOT clear memory.
   * applyStorageScope must reset explicitly — that is what these tests prove.
   */
  function makePersistStoreHoisted<T extends object>(initial: T, name: string) {
    let state = { ...initial };
    let persistName = name;
    const storage = () => globalThis.localStorage;
    const api = {
      getState: () => state as T & Record<string, unknown>,
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
            // Real zustand: leave in-memory state as-is when key is missing.
            return;
          }
          try {
            const parsed = JSON.parse(raw) as { state?: T };
            if (parsed?.state) state = { ...initial, ...parsed.state };
          } catch {
            /* keep memory */
          }
        },
      },
      /** Test helpers matching production store APIs */
      _replace(next: T) {
        state = { ...next };
      },
      _initial: initial,
    };
    return api;
  }

  const cvInner = makePersistStoreHoisted<CvBucket>(
    {
      cv: sample,
      activeTemplate: "aurora",
      baseline: null,
      started: false,
      ignoredSkills: [],
    },
    "orire-cv:anon:v1",
  );
  const cvStore = {
    ...cvInner,
    getState: () => ({
      ...cvInner.getState(),
      reset: () => {
        cvInner._replace({ ...cvInner._initial });
        try {
          globalThis.localStorage?.setItem(
            cvInner.persist.getOptions().name!,
            JSON.stringify({ state: cvInner._initial }),
          );
        } catch {
          /* ignore */
        }
      },
    }),
    setState: cvInner.setState,
    persist: cvInner.persist,
  };

  const libInner = makePersistStoreHoisted(
    {
      versions: [] as { id: string; name?: string; cv?: LooseCv }[],
      activeId: null as string | null,
      lastCompany: "",
      cloud: false,
    },
    "orire-library:anon:v1",
  );
  const libraryStore = {
    ...libInner,
    getState: () => ({
      ...libInner.getState(),
      clear: () => {
        const empty = { versions: [], activeId: null, lastCompany: "", cloud: false };
        libInner._replace(empty);
        try {
          globalThis.localStorage?.setItem(
            libInner.persist.getOptions().name!,
            JSON.stringify({ state: empty }),
          );
        } catch {
          /* ignore */
        }
      },
    }),
    setState: libInner.setState,
    persist: libInner.persist,
  };

  const targetInner = makePersistStoreHoisted(
    {
      ideal: null as unknown,
      jd: "",
      label: "",
      createdAt: null as number | null,
      baseScore: 0,
    },
    "orire-target:anon:v1",
  );
  const targetStore = {
    ...targetInner,
    getState: () => ({
      ...targetInner.getState(),
      clearTarget: () => {
        const empty = { ideal: null, jd: "", label: "", createdAt: null, baseScore: 0 };
        targetInner._replace(empty);
        try {
          globalThis.localStorage?.setItem(
            targetInner.persist.getOptions().name!,
            JSON.stringify({ state: empty }),
          );
        } catch {
          /* ignore */
        }
      },
    }),
    setState: targetInner.setState,
    persist: targetInner.persist,
  };

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
    cvStore.getState().reset();
    libraryStore.getState().clear();
    targetStore.getState().clearTarget();
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

  it("does not carry Account A CV into empty Account B (direct switch)", async () => {
    cvStore.setState({
      cv: realCv("Alice"),
      activeTemplate: "aurora",
      baseline: null,
      started: true,
      ignoredSkills: [],
    });
    libraryStore.setState({
      versions: [{ id: "v1", name: "Alice v1", cv: realCv("Alice") }],
      activeId: "v1",
      lastCompany: "Acme",
      cloud: false,
    });
    await applyStorageScope("alice");
    // Persist Alice into her key
    cvStore.setState({
      cv: realCv("Alice Saved"),
      activeTemplate: "aurora",
      baseline: null,
      started: true,
      ignoredSkills: [],
    });

    await applyStorageScope("bob");
    expect(cvStore.persist.getOptions().name).toBe(scopedNameFor("cv", "bob"));
    // Empty bob bucket + zustand-style empty rehydrate must still yield sample, not Alice
    expect(cvStore.getState().cv.basics.email).toContain("@example.com");
    expect(cvStore.getState().started).toBe(false);
    expect(libraryStore.getState().versions).toEqual([]);

    await applyStorageScope("alice");
    expect(cvStore.getState().cv.basics.fullName).toBe("Alice Saved");
  });

  it("wipes guest bucket on sign-out so next account cannot inherit", async () => {
    cvStore.setState({
      cv: realCv("Account A Work"),
      activeTemplate: "aurora",
      baseline: null,
      started: true,
      ignoredSkills: [],
    });
    await applyStorageScope("user_a");
    cvStore.setState({
      cv: realCv("Account A Work"),
      activeTemplate: "aurora",
      baseline: null,
      started: true,
      ignoredSkills: [],
    });

    await applyStorageScope(null);
    expect(getStorageScopeState().userId).toBeNull();
    expect(cvStore.getState().cv.basics.email).toContain("@example.com");
    expect(cvStore.getState().started).toBe(false);
    expect(libraryStore.getState().versions).toEqual([]);

    await applyStorageScope("user_b");
    expect(cvStore.getState().cv.basics.email).toContain("@example.com");
    expect(cvStore.getState().cv.basics.fullName).not.toBe("Account A Work");
  });
});
