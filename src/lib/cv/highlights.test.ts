import { describe, expect, it } from "vitest";
import { insertBlankAfter } from "./highlights";

describe("insertBlankAfter", () => {
  it("inserts an empty bullet after the given index", () => {
    expect(insertBlankAfter(["a", "b", "c"], 0)).toEqual(["a", "", "b", "c"]);
    expect(insertBlankAfter(["a", "b", "c"], 2)).toEqual(["a", "b", "c", ""]);
  });
  it("appends when the index is past the end and prepends when negative", () => {
    expect(insertBlankAfter(["a"], 9)).toEqual(["a", ""]);
    expect(insertBlankAfter(["a"], -5)).toEqual(["", "a"]);
  });
  it("does not mutate the input", () => {
    const src = ["a"];
    insertBlankAfter(src, 0);
    expect(src).toEqual(["a"]);
  });
});
