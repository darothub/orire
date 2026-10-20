import { describe, it, expect } from "vitest";
import { moveById, moveAt } from "./reorder";

describe("moveById", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("swaps an item with its later neighbor", () => {
    expect(moveById(list, "a", 1)).toEqual([{ id: "b" }, { id: "a" }, { id: "c" }]);
  });

  it("swaps an item with its earlier neighbor", () => {
    expect(moveById(list, "c", -1)).toEqual([{ id: "a" }, { id: "c" }, { id: "b" }]);
  });

  it("returns the same reference, unchanged, at the start boundary", () => {
    const res = moveById(list, "a", -1);
    expect(res).toBe(list);
  });

  it("returns the same reference, unchanged, at the end boundary", () => {
    const res = moveById(list, "c", 1);
    expect(res).toBe(list);
  });

  it("returns the same reference, unchanged, for an unknown id", () => {
    const res = moveById(list, "zzz", 1);
    expect(res).toBe(list);
  });

  it("does not mutate the input array", () => {
    const copy = [...list];
    moveById(list, "a", 1);
    expect(list).toEqual(copy);
  });
});

describe("moveAt", () => {
  const list = ["x", "y", "z"];

  it("swaps the item at index with its later neighbor", () => {
    expect(moveAt(list, 0, 1)).toEqual(["y", "x", "z"]);
  });

  it("swaps the item at index with its earlier neighbor", () => {
    expect(moveAt(list, 2, -1)).toEqual(["x", "z", "y"]);
  });

  it("returns the same reference, unchanged, at the start boundary", () => {
    expect(moveAt(list, 0, -1)).toBe(list);
  });

  it("returns the same reference, unchanged, at the end boundary", () => {
    expect(moveAt(list, 2, 1)).toBe(list);
  });

  it("returns the same reference, unchanged, for an out-of-range index", () => {
    expect(moveAt(list, 5, 1)).toBe(list);
    expect(moveAt(list, -1, 1)).toBe(list);
  });

  it("does not mutate the input array", () => {
    const copy = [...list];
    moveAt(list, 0, 1);
    expect(list).toEqual(copy);
  });
});
