import { describe, expect, it } from "vitest";
import { OCC_AGENTS, DEFAULT_OCC_AGENT, classifyOccConversation, getOccAgent } from "./agents";

describe("OCC 2.0 agent taxonomy", () => {
  it("defaults to a supported review agent", () => {
    expect(DEFAULT_OCC_AGENT).toBe("review");
    expect(getOccAgent(DEFAULT_OCC_AGENT).task).toBe("analysis");
    expect(getOccAgent("unknown")).toEqual(getOccAgent("review"));
    expect(new Set(OCC_AGENTS.map(agent => agent.id)).size).toBe(OCC_AGENTS.length);
    expect(OCC_AGENTS.map(agent => agent.task)).toEqual(["analysis", "interview", "versions", "memory"]);
  });
  it("groups each chat once with optional secondary smart collections", () => {
    expect(classifyOccConversation("review", ["interview", "review", "improve"]))
      .toEqual({ primary: "review", collections: ["review", "coach", "improvement"] });
    expect(classifyOccConversation("interview"))
      .toEqual({ primary: "coach", collections: ["coach"] });
  });
});
