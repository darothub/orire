import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { signCaptchaProof, verifyCaptchaProof, CAPTCHA_TTL } from "./turnstile";

describe("captcha proof (signed, expiring)", () => {
  let prior: string | undefined;
  beforeAll(() => {
    prior = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "test-secret-key-long-enough-for-hmac";
  });
  afterAll(() => {
    if (prior === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prior;
  });

  it("accepts a freshly minted proof", () => {
    expect(verifyCaptchaProof(signCaptchaProof())).toBe(true);
  });

  it("rejects the old unsigned \"1\" value (the bypass)", () => {
    expect(verifyCaptchaProof("1")).toBe(false);
  });

  it("rejects empty / missing values", () => {
    expect(verifyCaptchaProof(undefined)).toBe(false);
    expect(verifyCaptchaProof(null)).toBe(false);
    expect(verifyCaptchaProof("")).toBe(false);
    expect(verifyCaptchaProof("no-dot")).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const [body] = signCaptchaProof().split(".", 2);
    expect(verifyCaptchaProof(`${body}.AAAAAAAA`)).toBe(false);
  });

  it("rejects a proof signed with a different secret", () => {
    const token = signCaptchaProof();
    process.env.AUTH_SECRET = "a-completely-different-secret-value";
    expect(verifyCaptchaProof(token)).toBe(false);
    process.env.AUTH_SECRET = "test-secret-key-long-enough-for-hmac";
  });

  it("rejects an expired proof", () => {
    const token = signCaptchaProof();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (CAPTCHA_TTL + 1) * 1000);
    expect(verifyCaptchaProof(token)).toBe(false);
    vi.useRealTimers();
  });
});
