import { describe, it, expect } from "vitest";
import { routeTask, type AiTaskType } from "@/lib/ai/server/providerRouter";

describe("providerRouter", () => {
  it("routes refine to Claude Haiku 4.5", () => {
    const route = routeTask("refine");
    expect(route).toEqual({ provider: "anthropic", model: "claude-haiku-4-5" });
  });

  it("routes cover-letter to GPT-5-Mini", () => {
    const route = routeTask("cover-letter");
    expect(route).toEqual({ provider: "openai", model: "gpt-5-mini" });
  });

  it("routes simulate to GPT-5-Mini", () => {
    const route = routeTask("simulate");
    expect(route).toEqual({ provider: "openai", model: "gpt-5-mini" });
  });

  it("routes judge (pick the best) to GPT-5-Mini on ChatGPT", () => {
    const route = routeTask("judge");
    expect(route).toEqual({ provider: "openai", model: "gpt-5-mini" });
  });

  it("routes retone to GPT-5-Mini", () => {
    const route = routeTask("retone");
    expect(route).toEqual({ provider: "openai", model: "gpt-5-mini" });
  });

  it("handles all task types consistently", () => {
    const taskTypes: AiTaskType[] = ["refine", "cover-letter", "simulate", "judge", "retone"];
    taskTypes.forEach((taskType) => {
      const route = routeTask(taskType);
      expect(route).toHaveProperty("provider");
      expect(route).toHaveProperty("model");
      expect(["openai", "anthropic"]).toContain(route.provider);
      expect(route.model).toBeTruthy();
    });
  });
});
