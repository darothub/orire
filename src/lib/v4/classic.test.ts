import { describe, expect, it } from "vitest";
import { wantsClassic } from "./classic";

describe("wantsClassic", () => {
  it("is true only for ?classic=1", () => {
    expect(wantsClassic("?classic=1")).toBe(true);
    expect(wantsClassic("?a=1&classic=1")).toBe(true);
    expect(wantsClassic("")).toBe(false);
    expect(wantsClassic("?classic=0")).toBe(false);
    expect(wantsClassic("?classic")).toBe(false);
  });
});
