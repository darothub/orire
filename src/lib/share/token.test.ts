import { describe, it, expect } from "vitest";
import { newShareToken, shareUrl } from "./token";

describe("newShareToken", () => {
  it("is URL-safe, long, and unique", () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no +/= or slashes
    expect(a.length).toBeGreaterThanOrEqual(20);
    expect(a).not.toBe(b);
  });
});

describe("shareUrl", () => {
  it("builds the public URL and tolerates a trailing slash on origin", () => {
    expect(shareUrl("https://orire.app", "abc")).toBe("https://orire.app/cv/abc");
    expect(shareUrl("https://orire.app/", "abc")).toBe("https://orire.app/cv/abc");
  });
});
