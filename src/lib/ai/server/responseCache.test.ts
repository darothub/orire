import { afterEach, describe, expect, it } from "vitest";
import type { CallOpts } from "./providerCall";
import {
  __resetResponseCache,
  cacheEnabled,
  cacheKey,
  getCached,
  isCacheable,
  setCached,
} from "./responseCache";

const DET: CallOpts = { temperature: 0, seed: 1217 };

afterEach(() => {
  __resetResponseCache();
  delete process.env.AI_CACHE_DISABLED;
  delete process.env.AI_CACHE_TTL_MS;
  delete process.env.AI_CACHE_MAX;
});

describe("isCacheable", () => {
  it("is true only for temperature 0", () => {
    expect(isCacheable(DET)).toBe(true);
    expect(isCacheable({ temperature: 0.7 })).toBe(false);
    expect(isCacheable({})).toBe(false);
    expect(isCacheable(undefined)).toBe(false);
  });
});

describe("cacheEnabled", () => {
  it("is on by default and off when AI_CACHE_DISABLED=1", () => {
    expect(cacheEnabled()).toBe(true);
    process.env.AI_CACHE_DISABLED = "1";
    expect(cacheEnabled()).toBe(false);
  });
});

describe("cacheKey", () => {
  it("is stable for identical inputs", () => {
    expect(cacheKey("openai", "gpt", "sys", "user", DET)).toBe(
      cacheKey("openai", "gpt", "sys", "user", DET),
    );
  });

  it("differs when any input changes", () => {
    const base = cacheKey("openai", "gpt", "sys", "user", DET);
    expect(cacheKey("anthropic", "gpt", "sys", "user", DET)).not.toBe(base);
    expect(cacheKey("openai", "gpt2", "sys", "user", DET)).not.toBe(base);
    expect(cacheKey("openai", "gpt", "sys2", "user", DET)).not.toBe(base);
    expect(cacheKey("openai", "gpt", "sys", "user2", DET)).not.toBe(base);
    expect(cacheKey("openai", "gpt", "sys", "user", { temperature: 0, seed: 99 })).not.toBe(base);
  });
});

describe("get/setCached", () => {
  it("returns stored content before expiry", () => {
    setCached("k", "hello", 1_000);
    expect(getCached("k", 1_500)).toBe("hello");
  });

  it("misses on an unknown key", () => {
    expect(getCached("nope")).toBeNull();
  });

  it("expires entries after the TTL and evicts them", () => {
    process.env.AI_CACHE_TTL_MS = "100";
    setCached("k", "v", 1_000);
    expect(getCached("k", 1_050)).toBe("v");
    expect(getCached("k", 1_200)).toBeNull();
    // A second lookup confirms the expired entry was dropped, not just skipped.
    expect(getCached("k", 1_050)).toBeNull();
  });

  it("enforces the max-entry cap by evicting the oldest", () => {
    process.env.AI_CACHE_MAX = "2";
    setCached("a", "1", 1_000);
    setCached("b", "2", 1_000);
    setCached("c", "3", 1_000); // evicts "a"
    expect(getCached("a", 1_100)).toBeNull();
    expect(getCached("b", 1_100)).toBe("2");
    expect(getCached("c", 1_100)).toBe("3");
  });
});
