import { describe, expect, it } from "vitest";
import { V4_BASE, V4_NAV, V4_STUDIO_TABS, studioTabFor } from "./nav";

describe("v4 navigation", () => {
  it("lists the Copilot as its own destination, beside the studio", () => {
    expect(V4_NAV.map((n) => n.key)).toEqual(["home", "studio", "copilot", "library", "export"]);
  });

  it("maps studio paths to their tool, with Edit as the default", () => {
    expect(studioTabFor("/app/studio").key).toBe("edit");
    expect(studioTabFor("/app/studio/simulate").key).toBe("simulate");
    expect(studioTabFor("/app/studio/refine").key).toBe("refine");
    expect(studioTabFor("/app/studio/interview").key).toBe("interview");
    expect(studioTabFor("/app/studio/unknown").key).toBe("edit");
  });

  it("keeps every v4 link under the one base path", () => {
    const hrefs = [...V4_NAV.map((n) => n.href), ...V4_STUDIO_TABS.map((t) => t.href)];
    expect(V4_BASE).toBe("/app");
    expect(hrefs.every((h) => h === V4_BASE || h.startsWith(`${V4_BASE}/`))).toBe(true);
  });

  it("gives every tool a distinct route", () => {
    expect(new Set(V4_STUDIO_TABS.map((t) => t.href)).size).toBe(V4_STUDIO_TABS.length);
  });
});
