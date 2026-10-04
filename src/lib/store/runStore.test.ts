import { describe, it, expect, beforeEach } from "vitest";
import { sharedRun, isRunActive, useRunStore } from "./runStore";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("runStore sharedRun", () => {
  beforeEach(() => {
    useRunStore.setState({ active: {} });
  });

  it("marks a kind active for the lifetime of the run", async () => {
    const d = deferred<string>();
    expect(isRunActive("simulate")).toBe(false);
    const p = sharedRun("simulate", "Simulate", () => d.promise);
    expect(isRunActive("simulate")).toBe(true);
    expect(useRunStore.getState().active["simulate"]?.origin).toBe("Simulate");
    d.resolve("ok");
    await p;
    expect(isRunActive("simulate")).toBe(false);
  });

  it("dedupes concurrent calls of the same kind to one in-flight promise", async () => {
    let calls = 0;
    const d = deferred<number>();
    const fn = () => {
      calls += 1;
      return d.promise;
    };
    const a = sharedRun("simulate", "Refine", fn);
    const b = sharedRun("simulate", "Simulate", fn); // second caller must not re-fire
    expect(calls).toBe(1);
    d.resolve(42);
    expect(await a).toBe(42);
    expect(await b).toBe(42); // both resolve from the same request
  });

  it("keeps the origin of the first caller while shared", async () => {
    const d = deferred<void>();
    const a = sharedRun("simulate", "Refine", () => d.promise);
    sharedRun("simulate", "Simulate", () => d.promise);
    expect(useRunStore.getState().active["simulate"]?.origin).toBe("Refine");
    d.resolve();
    await a;
  });

  it("allows different kinds to run in parallel", async () => {
    const d1 = deferred<void>();
    const d2 = deferred<void>();
    const a = sharedRun("refine:openai", "Refine", () => d1.promise);
    const b = sharedRun("refine:claude", "Refine", () => d2.promise);
    expect(isRunActive("refine:openai")).toBe(true);
    expect(isRunActive("refine:claude")).toBe(true);
    d1.resolve();
    d2.resolve();
    await Promise.all([a, b]);
    expect(isRunActive("refine:openai")).toBe(false);
    expect(isRunActive("refine:claude")).toBe(false);
  });

  it("clears the active flag even when the run rejects", async () => {
    const d = deferred<void>();
    const p = sharedRun("judge", "Refine", () => d.promise);
    expect(isRunActive("judge")).toBe(true);
    d.reject(new Error("boom"));
    await expect(p).rejects.toThrow("boom");
    expect(isRunActive("judge")).toBe(false);
  });

  it("re-fires after the previous run of the same kind settles", async () => {
    let calls = 0;
    const d1 = deferred<void>();
    const fn1 = () => { calls += 1; return d1.promise; };
    const p1 = sharedRun("simulate", "Simulate", fn1);
    d1.resolve();
    await p1;

    const d2 = deferred<void>();
    const fn2 = () => { calls += 1; return d2.promise; };
    const p2 = sharedRun("simulate", "Simulate", fn2);
    expect(calls).toBe(2); // not deduped against the settled run
    d2.resolve();
    await p2;
  });
});
