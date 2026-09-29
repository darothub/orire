/**
 * orire — AI layer types.
 *
 * BYO-key model: the user supplies their own provider API key. Keys live only
 * in the browser (localStorage) and are forwarded per-request to our local
 * Next.js route, which proxies the provider call. No key is ever persisted
 * server-side or sent to any third party other than the chosen provider.
 */

export type ProviderId = "openai" | "anthropic" | "claude-cli" | "codex-cli";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** How the connection authenticates. "api" = BYO key; "cli" = local binary. */
  kind: "api" | "cli";
  /** Human label for the key, e.g. "sk-…". Empty for CLI providers. */
  keyHint: string;
  defaultModel: string;
  models: string[];
  /** Short note shown in place of a key field for CLI providers. */
  authHint?: string;
  /** Executable name probed/spawned for CLI providers (e.g. "claude", "codex"). */
  cliBin?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  openai: {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    kind: "api",
    keyHint: "sk-…",
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
    kind: "api",
    keyHint: "sk-ant-…",
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
  "claude-cli": {
    id: "claude-cli",
    label: "Claude Code (CLI)",
    kind: "cli",
    keyHint: "",
    authHint: "Uses your local Claude Code login — no API key needed.",
    cliBin: "claude",
    defaultModel: "sonnet",
    models: ["sonnet", "opus", "haiku"],
  },
  "codex-cli": {
    id: "codex-cli",
    label: "Codex (CLI)",
    kind: "cli",
    keyHint: "",
    authHint: "Uses your local Codex login (`codex login`) — no API key needed.",
    cliBin: "codex",
    defaultModel: "gpt-5-codex",
    models: ["gpt-5-codex", "gpt-5", "o4-mini", "o3"],
  },
};

/** True when a provider authenticates with a BYO API key (vs a local CLI login). */
export function needsKey(provider: ProviderId): boolean {
  return PROVIDERS[provider].kind === "api";
}

/** True when a provider is backed by a local command-line binary. */
export function isCLI(provider: ProviderId): boolean {
  return PROVIDERS[provider].kind === "cli";
}

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
