import { describe, expect, it } from "vitest";
import { homeNext, pipelineCounts, weeklyActivity } from "./home";

const base = { hasCv: true, hasJd: true, coverage: null as number | null, applications: 0 };

describe("homeNext", () => {
  it("asks for the missing inputs first", () => {
    expect(homeNext({ ...base, hasCv: false, hasJd: false })).toMatchObject({ action: "context" });
    expect(homeNext({ ...base, hasJd: false }).body).toContain("a job description");
    expect(homeNext({ ...base, hasCv: false }).body).toContain("your CV");
  });
  it("checks coverage before anything else once both exist", () => {
    expect(homeNext(base).action).toBe("match");
  });
  it("refines below the threshold, never at it", () => {
    expect(homeNext({ ...base, coverage: 79 }).action).toBe("refine");
    expect(homeNext({ ...base, coverage: 80 }).action).toBe("applications");
  });
  it("moves on to export once applications are tracked", () => {
    expect(homeNext({ ...base, coverage: 90, applications: 2 }).action).toBe("export");
  });
});

describe("pipelineCounts", () => {
  it("counts active, interview and offer", () => {
    const apps = (["saved", "applied", "interview", "offer"] as const).map((status) => ({ status, updatedAt: "" }));
    expect(pipelineCounts(apps)).toEqual({ active: 3, interview: 1, offer: 1 });
    expect(pipelineCounts([])).toEqual({ active: 0, interview: 0, offer: 0 });
  });
});

describe("weeklyActivity", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  const day = 24 * 3600 * 1000;
  it("buckets by week, newest last, ignoring old and future dates", () => {
    const at = (d: number) => new Date(now - d * day).toISOString();
    expect(weeklyActivity([at(0), at(1), at(8), at(41), at(42), at(-3)], now)).toEqual([1, 0, 0, 0, 1, 2]);
  });
  it("ignores unparseable dates", () => {
    expect(weeklyActivity(["nope"], now)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
