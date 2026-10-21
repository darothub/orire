import { describe, it, expect } from "vitest";
import { pickActivationGap } from "./activation";

describe("pickActivationGap", () => {
  it("recommends 'both' when neither has happened", () => {
    expect(pickActivationGap({ exported: false, simulated: false })).toBe("both");
  });

  it("recommends 'export' when only Simulate has been tried", () => {
    expect(pickActivationGap({ exported: false, simulated: true })).toBe("export");
  });

  it("recommends 'simulate' when only an export has happened", () => {
    expect(pickActivationGap({ exported: true, simulated: false })).toBe("simulate");
  });

  it("recommends nothing once both have happened", () => {
    expect(pickActivationGap({ exported: true, simulated: true })).toBeNull();
  });
});
