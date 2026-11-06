import { describe, expect, it } from "vitest";
import { aiStudioRoles } from "./aiStudio";

describe("aiStudioRoles", () => {
  it("returns unique, complete roles with valid match values", () => {
    const roles = aiStudioRoles();
    expect(roles.length).toBeGreaterThanOrEqual(3);
    expect(new Set(roles.map((r) => r.id)).size).toBe(roles.length);
    for (const r of roles) {
      expect(r.before && r.after && r.jd).toBeTruthy();
      expect(r.keywords.length).toBeGreaterThan(0);
      expect(r.match).toBeGreaterThanOrEqual(0);
      expect(r.match).toBeLessThanOrEqual(100);
    }
  });
});
