import { describe, it, expect } from "vitest";
import { workspaceBusy } from "@/lib/store/busy";

const idle = { active: {}, judgePhase: "idle", refineColPhases: ["idle"] };

describe("workspaceBusy", () => {
  it("is idle when nothing runs", () => {
    expect(workspaceBusy(idle)).toEqual({ refine: false, simulate: false });
  });

  it("simulate or retone does not mark refine busy", () => {
    expect(workspaceBusy({ ...idle, active: { simulate: {} } })).toEqual({ refine: false, simulate: true });
    expect(workspaceBusy({ ...idle, active: { retone: {} } })).toEqual({ refine: false, simulate: true });
  });

  it("refine columns or judge do not mark simulate busy", () => {
    expect(workspaceBusy({ ...idle, refineColPhases: ["running", "idle"] })).toEqual({ refine: true, simulate: false });
    expect(workspaceBusy({ ...idle, judgePhase: "running" })).toEqual({ refine: true, simulate: false });
    expect(workspaceBusy({ ...idle, active: { judge: {} } })).toEqual({ refine: true, simulate: false });
  });

  it("both can be busy at once", () => {
    expect(workspaceBusy({ active: { simulate: {} }, judgePhase: "idle", refineColPhases: ["running"] }))
      .toEqual({ refine: true, simulate: true });
  });
});
