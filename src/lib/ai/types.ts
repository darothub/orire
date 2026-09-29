/**
 * orire — AI layer types.
 *
 * BYO-key model: the user supplies their own provider API key. Keys live only
 * in the browser (localStorage) and are forwarded per-request to our local
 * Next.js route, which proxies the provider call. No key is ever persisted
 * server-side or sent to any third party other than the chosen provider.
 */

export type ProviderId = "openai" | "anthropic";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** Human label for the key, e.g. "sk-…". */
  keyHint: string;
  defaultModel: string;
  models: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    keyHint: "sk-…",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyHint: "sk-ant-…",
    defaultModel: "claude-3-5-sonnet-latest",
    models: [
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-7-sonnet-latest",
    ],
  },
};

/** Request payload posted to /api/ai/refine. */
export interface RefineRequest {
  provider: ProviderId;
  apiKey: string;
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
