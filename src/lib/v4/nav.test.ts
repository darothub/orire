import { describe, expect, it } from "vitest";
import { V4_NAV, V4_STUDIO_TABS, studioTabFor } from "./nav";

describe("v4 navigation", () => {
  it("lists the Copilot as its own destination, beside the studio", () => {
    expect(V4_NAV.map((n) => n.key)).toEqual(["home", "studio", "copilot", "library", "export"]);
  });

  it("maps studio paths to their tool, with Edit as the default", () => {
    expect(studioTabFor("/v4/studio").key).toBe("edit");
    expect(studioTabFor("/v4/studio/simulate").key).toBe("simulate");
    expect(studioTabFor("/v4/studio/refine").key).toBe("refine");
    expect(studioTabFor("/v4/studio/interview").key).toBe("interview");
    expect(studioTabFor("/v4/studio/unknown").key).toBe("edit");
  });

  it("gives every tool a distinct route", () => {
    expect(new Set(V4_STUDIO_TABS.map((t) => t.href)).size).toBe(V4_STUDIO_TABS.length);
  });
});
