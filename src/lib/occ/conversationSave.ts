import { DEFAULT_OCC_AGENT, OCC_AGENTS, type OccAgentId } from "./agents";

export type SavedOccTurn = { role: "you" | "OCC"; text: string };
export type SaveOccConversation = {
  id?: string;
  title: string;
  primaryAgent: OccAgentId;
  usedAgents: OccAgentId[];
  turns: SavedOccTurn[];
};

/** Explicit transcript-only saving; document contents are intentionally excluded. */
export function validateOccConversationSave(input: unknown): SaveOccConversation | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const x = input as Record<string, unknown>;
  const ids = new Set<string>(OCC_AGENTS.map(agent => agent.id));
  if (x.id !== undefined && (typeof x.id !== "string" || x.id.length > 100 || !/^c[a-z0-9]+$/i.test(x.id))) return null;
  if (typeof x.title !== "string" || x.title.trim().length < 1 || x.title.length > 120 ||
      typeof x.primaryAgent !== "string" || !ids.has(x.primaryAgent) ||
      !Array.isArray(x.usedAgents) || x.usedAgents.length > 4 ||
      x.usedAgents.some(v => typeof v !== "string" || !ids.has(v)) ||
      !Array.isArray(x.turns) || x.turns.length === 0 || x.turns.length > 100) return null;
  const turns: SavedOccTurn[] = [];
  let total = 0;
  for (const turn of x.turns) {
    if (!turn || typeof turn !== "object" || Array.isArray(turn)) return null;
    const t = turn as Record<string, unknown>;
    if ((t.role !== "you" && t.role !== "OCC") || typeof t.text !== "string" ||
      t.text.trim().length < 1 || t.text.length > 2500) return null;
    total += t.text.length;
    turns.push({ role: t.role, text: t.text });
  }
  if (total > 60000) return null;
  return { ...(x.id ? { id: x.id as string } : {}),
    title: x.title.trim(),
    primaryAgent: (x.primaryAgent as OccAgentId) || DEFAULT_OCC_AGENT,
    usedAgents: [...new Set(x.usedAgents as OccAgentId[])],
    turns,
  };
}
