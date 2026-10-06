/**
 * orire — managed (server-side) provider keys.
 *
 * orire holds the provider API keys. Users never bring their own key; every
 * request runs on orire's keys and plan gating governs what each account may
 * do. Keys are read from the environment and never leave the server.
 */

import type { ProviderId } from "@/lib/ai/types";

const KEY_ENV: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

const PROVIDER_LABEL: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

/** The server-side API key for a provider, or null when it isn't configured. */
export function serverKeyFor(provider: ProviderId): string | null {
  const raw = process.env[KEY_ENV[provider]];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/** Whether orire has a usable server key for this provider. */
export function providerConfigured(provider: ProviderId): boolean {
  return serverKeyFor(provider) !== null;
}

/** User-facing message when a provider has no server key configured. */
export function notConfiguredMessage(provider: ProviderId): string {
  return `${PROVIDER_LABEL[provider]} isn’t available right now — the Orire server has no API key configured for it. Please try the other assistant or contact support.`;
}
