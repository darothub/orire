import { describe, it, expect, beforeEach } from "vitest";
import { useSyncStore } from "./syncStore";

describe("syncStore", () => {
  beforeEach(() => useSyncStore.setState({ status: "idle" }));

  it("defaults to idle", () => {
    expect(useSyncStore.getState().status).toBe("idle");
  });

  it("transitions through saving -> saved", () => {
    useSyncStore.getState().setStatus("saving");
    expect(useSyncStore.getState().status).toBe("saving");
    useSyncStore.getState().setStatus("saved");
    expect(useSyncStore.getState().status).toBe("saved");
  });

  it("can report an error", () => {
    useSyncStore.getState().setStatus("error");
    expect(useSyncStore.getState().status).toBe("error");
  });
});
