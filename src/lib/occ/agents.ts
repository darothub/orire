import type { OccTask } from "./orchestrator";

/**
 * OCC service taxonomy for automatic virtual collections.
 * Classification is metadata, never a directory path or authorization rule.
 * Only implemented tools can be selectable agents.
 */
export const OCC_AGENTS = [
  { id: "review", label: "CV Review", description: "Compare CV evidence with a target role", task: "analysis", collection: "review" },
  { id: "interview", label: "Interview Coach", description: "Practice questions with grounded feedback", task: "interview", collection: "coach" },
  { id: "improve", label: "CV Improvement", description: "Review and approve wording changes", task: "versions", collection: "improvement" },
  { id: "memory", label: "Career Memory", description: "Review information OCC remembers", task: "memory", collection: "career" },
] as const satisfies readonly { id: string; label: string; description: string; task: OccTask; collection: string }[];

export type OccAgentId = (typeof OCC_AGENTS)[number]["id"];
export type OccServiceCollection = (typeof OCC_AGENTS)[number]["collection"] | "strategy";

export const DEFAULT_OCC_AGENT: OccAgentId = "review";

export function getOccAgent(id: string) {
  return OCC_AGENTS.find(agent => agent.id === id) ?? OCC_AGENTS[0];
}

/** One canonical conversation can be visible in multiple smart collections. */
export function classifyOccConversation(
  startingAgent: OccAgentId,
  usedAgents: readonly OccAgentId[] = [],
): { primary: OccServiceCollection; collections: OccServiceCollection[] } {
  const primary = getOccAgent(startingAgent).collection;
  const collections = Array.from(new Set([primary, ...usedAgents.map(id => getOccAgent(id).collection)]));
  return { primary, collections };
}
