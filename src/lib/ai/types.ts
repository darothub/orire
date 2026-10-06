/**
 * orire — AI layer types.
 *
 * Managed-key model: orire holds the provider API keys server-side. The client
 * never sends a key; it only names the provider + model, and the Next.js route
 * resolves orire's own key for that provider. Plan gating (not key possession)
 * governs which models an account may run.
 */

export type ProviderId = "openai" | "anthropic";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  defaultModel: string;
  models: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: "openai",
    // Default to the cheap, JSON-reliable budget tier (GPT-5 Mini). Nano is the
    // rock-bottom option; gpt-5 is the mid upgrade; o3 is the premium reasoner.
    label: "OpenAI (ChatGPT)",
    defaultModel: "gpt-5-mini",
    models: [
      "gpt-5-nano",
      "gpt-5-mini",
      "gpt-5",
      "gpt-4o-mini",
      "o4-mini",
      "o3",
    ],
  },
  anthropic: {
    id: "anthropic",
    // Default to Claude Haiku 4.5 — the cheapest Anthropic model and the
    // strongest budget instruction/JSON follower, ideal for the refine patch.
    label: "Anthropic (Claude)",
    defaultModel: "claude-haiku-4-5",
    models: [
      "claude-haiku-4-5",
      "claude-sonnet-4-5",
      "claude-sonnet-5-5",
      "claude-opus-5-5",
    ],
  },
};

/** Request payload posted to /api/ai/refine. */
export interface RefineRequest {
  provider: ProviderId;
  model: string;
  jobDescription: string;
  /** The current CV — the sole source of truth for facts. */
  cv: unknown;
}

/** Verbatim provider error surfaced to the user (req 12). */
export interface AiError {
  provider: ProviderId;
  /** HTTP status from the provider, if any. */
  status?: number;
  /** Verbatim provider message / body. Never paraphrased. */
  message: string;
}

export interface RefineResponse {
  ok: boolean;
  /** Raw model text (expected to be JSON). Present when ok. */
  raw?: string;
  /** Model + provider echo for display. */
  provider: ProviderId;
  model: string;
  error?: AiError;
}
