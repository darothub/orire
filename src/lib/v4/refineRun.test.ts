import { afterEach, describe, expect, it, vi } from "vitest";

const authorize = vi.fn();
vi.mock("@/app/actions/refine", () => ({ authorizeRefineRun: (...a: unknown[]) => authorize(...a) }));

import { runRefine } from "./refineRun";
import type { CVData } from "@/lib/cv/schema";

const cv = { basics: { fullName: "A" }, experience: [], projects: [], skills: [], education: [], certifications: [] } as unknown as CVData;

afterEach(() => { vi.restoreAllMocks(); authorize.mockReset(); });

describe("runRefine", () => {
  it("stops with the plan message when the run is not authorized", async () => {
    authorize.mockResolvedValue({ ok: false, block: { title: "Limit reached", body: "Upgrade for more." } });
    expect(await runRefine(cv, "role")).toEqual({ kind: "stopped", message: "Limit reached: Upgrade for more." });
  });
  it("stops with the API's message when the provider call fails", async () => {
    authorize.mockResolvedValue({ ok: true, token: "t" });
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ ok: false, error: { message: "Provider down" } }) })));
    expect(await runRefine(cv, "role")).toEqual({ kind: "stopped", message: "Provider down" });
  });
  it("never throws: a network failure becomes a stopped outcome", async () => {
    authorize.mockResolvedValue({ ok: true, token: "t" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await runRefine(cv, "role")).kind).toBe("stopped");
  });
});
