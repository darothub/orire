import { describe, expect, it, beforeEach } from "vitest";
import {
  migrateAllLegacyKeys,
  migrateLegacyKey,
  rebindPersistName,
  scopedNameFor,
  scopedStorageName,
  storageHasPayload,
} from "./storageScope";

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

describe("scopedStorageName", () => {
  it("uses an anon segment when signed out", () => {
    expect(scopedStorageName("orire-cv", null)).toBe("orire-cv:anon:v1");
    expect(scopedStorageName("orire-cv", "")).toBe("orire-cv:anon:v1");
  });

  it("encodes the user id when signed in", () => {
    expect(scopedStorageName("orire-cv", "user_42")).toBe("orire-cv:u:user_42:v1");
    expect(scopedNameFor("library", "a/b")).toBe("orire-library:u:a%2Fb:v1");
  });
});

describe("migrateLegacyKey", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("moves legacy → anon when anon is empty", () => {
    storage.setItem("orire-cv-v1", JSON.stringify({ state: { started: true } }));
    expect(migrateLegacyKey(storage, "orire-cv-v1", "orire-cv:anon:v1")).toBe("moved");
    expect(storage.getItem("orire-cv:anon:v1")).toContain("started");
    expect(storage.getItem("orire-cv-v1")).toBeNull();
  });

  it("does not overwrite an existing anon payload", () => {
    storage.setItem("orire-cv-v1", "LEGACY");
    storage.setItem("orire-cv:anon:v1", "ANON");
    expect(migrateLegacyKey(storage, "orire-cv-v1", "orire-cv:anon:v1")).toBe("skipped");
    expect(storage.getItem("orire-cv:anon:v1")).toBe("ANON");
    expect(storage.getItem("orire-cv-v1")).toBeNull();
  });

  it("reports absent when there is nothing to move", () => {
    expect(migrateLegacyKey(storage, "orire-cv-v1", "orire-cv:anon:v1")).toBe("absent");
  });

  it("migrates every scoped store legacy key", () => {
    storage.setItem("orire-cv-v1", "a");
    storage.setItem("orire-library-v1", "b");
    storage.setItem("orire-target-v1", "c");
    storage.setItem("orire-plan-v1", "d");
    storage.setItem("orire-flow-v1", "e");
    migrateAllLegacyKeys(storage);
    expect(storageHasPayload(storage, "orire-cv:anon:v1")).toBe(true);
    expect(storageHasPayload(storage, "orire-library:anon:v1")).toBe(true);
    expect(storageHasPayload(storage, "orire-target:anon:v1")).toBe(true);
    expect(storageHasPayload(storage, "orire-plan:anon:v1")).toBe(true);
    expect(storageHasPayload(storage, "orire-flow:anon:v1")).toBe(true);
    expect(storage.getItem("orire-cv-v1")).toBeNull();
    expect(storage.getItem("orire-flow-v1")).toBeNull();
  });
});

describe("rebindPersistName", () => {
  it("rehydrates when the name changes and no-ops when it matches", async () => {
    let name = "old";
    let hydrations = 0;
    const store = {
      persist: {
        getOptions: () => ({ name }),
        setOptions: (o: { name?: string }) => {
          if (o.name) name = o.name;
        },
        rehydrate: async () => {
          hydrations += 1;
        },
      },
    };
    expect(await rebindPersistName(store, "old")).toEqual({ rebound: false });
    expect(hydrations).toBe(0);
    expect(await rebindPersistName(store, "new")).toEqual({ rebound: true });
    expect(name).toBe("new");
    expect(hydrations).toBe(1);
  });
});
