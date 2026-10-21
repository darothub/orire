import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { usePlanStore } from "./planStore";

const RESET = {
  plan: "free" as const,
  usageMonth: "2026-01",
  refinesUsed: 0,
  serverActive: false,
  serverUsed: 0,
};

describe("planStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T00:00:00Z"));
    usePlanStore.setState(RESET);
  });
  afterEach(() => vi.useRealTimers());

  it("refineUsed starts at zero", () => {
    expect(usePlanStore.getState().refineUsed()).toBe(0);
  });

  it("recordRefine increments the local counter, reflected by refineUsed", () => {
    usePlanStore.getState().recordRefine();
    usePlanStore.getState().recordRefine();
    expect(usePlanStore.getState().refineUsed()).toBe(2);
  });

  it("resets the local counter when the calendar month rolls over", () => {
    usePlanStore.getState().recordRefine();
    expect(usePlanStore.getState().refineUsed()).toBe(1);
    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    // A stale month's count reads as zero even before another refine runs...
    expect(usePlanStore.getState().refineUsed()).toBe(0);
    // ...and the next refine starts a fresh count for the new month.
    usePlanStore.getState().recordRefine();
    expect(usePlanStore.getState().refineUsed()).toBe(1);
  });

  it("once signed in (server-active), refineUsed reports the server mirror and ignores the local counter", () => {
    usePlanStore.getState().recordRefine();
    usePlanStore.getState().syncFromServer({ plan: "pro", usedThisMonth: 7 });
    expect(usePlanStore.getState().refineUsed()).toBe(7);
    expect(usePlanStore.getState().plan).toBe("pro");
    // The server owns the counter now — a local recordRefine() call is a no-op.
    usePlanStore.getState().recordRefine();
    expect(usePlanStore.getState().refineUsed()).toBe(7);
  });

  it("clearServer drops server truth and falls back to free + the local counter", () => {
    usePlanStore.getState().syncFromServer({ plan: "pro", usedThisMonth: 7 });
    usePlanStore.getState().clearServer();
    expect(usePlanStore.getState().plan).toBe("free");
    expect(usePlanStore.getState().refineUsed()).toBe(0);
  });
});
