import { describe, it, expect, beforeEach } from "vitest";
import { useTargetStore, isIdealStale } from "@/lib/store/targetStore";
import { sampleCV } from "@/lib/cv/sample";

describe("re-simulate prompt", () => {
  beforeEach(() => useTargetStore.getState().clearTarget());

  it("is ignored when no target is locked", () => {
    useTargetStore.getState().requestResim();
    expect(useTargetStore.getState().resimPrompt).toBe(false);
  });

  it("is raised for a locked target, and cleared on dismiss or a new lock", () => {
    const s = useTargetStore.getState();
    s.setTarget(sampleCV, "jd", 40);
    s.requestResim();
    expect(useTargetStore.getState().resimPrompt).toBe(true);
    useTargetStore.getState().dismissResim();
    expect(useTargetStore.getState().resimPrompt).toBe(false);
    useTargetStore.getState().requestResim();
    useTargetStore.getState().setTarget(sampleCV, "jd2", 50);
    expect(useTargetStore.getState().resimPrompt).toBe(false);
  });
});

describe("shared JD sync", () => {
  beforeEach(() => useTargetStore.getState().clearTarget());

  it("flags the ideal as stale only after the shared JD is edited", () => {
    useTargetStore.getState().setTarget(sampleCV, "Go role", 40);
    expect(isIdealStale(useTargetStore.getState())).toBe(false);
    useTargetStore.getState().setJd("Go role  "); // whitespace only
    expect(isIdealStale(useTargetStore.getState())).toBe(false);
    useTargetStore.getState().setJd("Rust role");
    expect(isIdealStale(useTargetStore.getState())).toBe(true);
    useTargetStore.getState().setTarget(sampleCV, "Rust role", 40);
    expect(isIdealStale(useTargetStore.getState())).toBe(false);
  });

  it("discardTarget keeps the JD; clearTarget (account wipe) drops it", () => {
    useTargetStore.getState().setTarget(sampleCV, "Go role", 40);
    useTargetStore.getState().discardTarget();
    expect(useTargetStore.getState().ideal).toBeNull();
    expect(useTargetStore.getState().jd).toBe("Go role");
    useTargetStore.getState().clearTarget();
    expect(useTargetStore.getState().jd).toBe("");
  });
});
