import { describe, expect, it } from "vitest";
import { v4Landing, wantsClassic } from "./classic";

describe("wantsClassic", () => {
  it("is true only for ?classic=1", () => {
    expect(wantsClassic("?classic=1")).toBe(true);
    expect(wantsClassic("?a=1&classic=1")).toBe(true);
    expect(wantsClassic("")).toBe(false);
    expect(wantsClassic("?classic=0")).toBe(false);
    expect(wantsClassic("?classic")).toBe(false);
  });
});

describe("v4Landing", () => {
  it("goes home, or to the plan page with the query when Stripe sent them back", () => {
    expect(v4Landing("")).toBe("/app");
    expect(v4Landing("?x=1")).toBe("/app");
    expect(v4Landing("?billing=success&plan=pro&sid=cs_1")).toBe("/app/plan?billing=success&plan=pro&sid=cs_1");
    expect(v4Landing("?billing=cancelled")).toBe("/app/plan?billing=cancelled");
  });
});
