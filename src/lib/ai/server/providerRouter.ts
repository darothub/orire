/**
 * orire — automatic provider routing based on AI task type.
 *
 * Routes tasks to optimal providers:
 * - CV refinement → Claude Haiku 4.5 (superior instruction-following, strict fact-grounding)
 * - Cover letter → GPT-5-Mini (creative writing)
 * - Interview simulate → GPT-5-Mini (ideal candidate profile generation)
 * - Judge → Claude Haiku 4.5 (deep CV comparison and analysis)
 * - Retone/restructure → GPT-5-Mini (tone adjustment)
 *
 * This dual-provider approach optimizes for both cost and quality:
 * - Haiku: $0.0245/month for refinement + judge
 * - GPT-5-Mini: $0.0161/month for cover letter + simulate + retone
 * - Total: $0.0566/user/month (current: $0.0738/user/month on single provider)
 */

import type { ProviderId } from "@/lib/ai/types";

export type AiTaskType = "refine" | "cover-letter" | "simulate" | "judge" | "retone" | "evidence";

export interface RouteDecision {
  provider: ProviderId;
  model: string;
}

/**
 * Route an AI task to the optimal provider.
 *
 * @param taskType The type of AI task being performed
 * @returns The provider and model to use for this task
 */
export function routeTask(taskType: AiTaskType): RouteDecision {
  switch (taskType) {
    case "refine":
      return { provider: "anthropic", model: "claude-haiku-4-5" };

    case "cover-letter":
      return { provider: "openai", model: "gpt-5-mini" };

    case "simulate":
      return { provider: "openai", model: "gpt-5-mini" };

    case "judge":
      return { provider: "anthropic", model: "claude-haiku-4-5" };

    case "retone":
    case "evidence":
      return { provider: "openai", model: "gpt-5-mini" };

    default:
      // Fallback (unreachable in practice, but TS needs exhaustive check)
      const _exhaustive: never = taskType;
      return _exhaustive;
  }
}
