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
    label: "OpenAI (ChatGPT)",
    defaultModel: "gpt-4o",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "o4-mini",
      "o3",
      "gpt-4-turbo",
    ],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-3-7-sonnet-latest",
    models: [
      "claude-3-7-sonnet-latest",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest",
      "claude-sonnet-4-0",
      "claude-opus-4-0",
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
