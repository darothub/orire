import { describe, it, expect, beforeEach } from "vitest";
import { useTargetStore } from "@/lib/store/targetStore";
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
