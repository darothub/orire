import { describe, it, expect, beforeEach } from "vitest";
import { __resetRateLimits } from "@/lib/ratelimit/rateLimit";
import { recordSignInFailure, signInCaptchaRequired } from "./captchaGate";

const h = (ip: string) => new Headers({ "x-forwarded-for": ip });

describe("on-demand sign-in captcha", () => {
  beforeEach(() => __resetRateLimits());

  it("is not required for a fresh client", async () => {
    expect(await signInCaptchaRequired(h("1.1.1.1"), "a@b.co")).toBe(false);
  });

  it("is required after two failures from the same IP", async () => {
    await recordSignInFailure(h("1.1.1.1"), "a@b.co");
    expect(await signInCaptchaRequired(h("1.1.1.1"), "a@b.co")).toBe(false);
    await recordSignInFailure(h("1.1.1.1"), "a@b.co");
    expect(await signInCaptchaRequired(h("1.1.1.1"), "other@b.co")).toBe(true);
  });

  it("is required for a targeted email even from fresh IPs", async () => {
    await recordSignInFailure(h("1.1.1.1"), "a@b.co");
    await recordSignInFailure(h("2.2.2.2"), "A@b.co");
    expect(await signInCaptchaRequired(h("3.3.3.3"), "a@b.co")).toBe(true);
    expect(await signInCaptchaRequired(h("3.3.3.3"), "x@b.co")).toBe(false);
  });
});
