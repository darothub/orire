import { describe, it, expect, beforeAll } from "vitest";

// Run tokens are HMAC-signed with AUTH_SECRET; set one before importing.
beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-run-tokens";
});

async function mod() {
  return await import("./runToken");
}

describe("runToken", () => {
  it("round-trips a valid token and exposes the payload", async () => {
    const { signRunToken, verifyRunToken } = await mod();
    const token = signRunToken({ userId: "u1", plan: "pro", providers: ["openai", "anthropic"] });
    const check = verifyRunToken(token);
    expect(check.ok).toBe(true);
    expect(check.payload?.u).toBe("u1");
    expect(check.payload?.plan).toBe("pro");
    expect(check.payload?.p).toEqual(["openai", "anthropic"]);
    expect(check.payload!.exp).toBeGreaterThan(Date.now());
  });

  it("carries a null user for anonymous runs", async () => {
    const { signRunToken, verifyRunToken } = await mod();
    const check = verifyRunToken(signRunToken({ userId: null, plan: "free", providers: ["openai"] }));
    expect(check.ok).toBe(true);
    expect(check.payload?.u).toBeNull();
  });

  it("round-trips an authorized failover and omits it when absent", async () => {
    const { signRunToken, verifyRunToken } = await mod();
    const withFb = verifyRunToken(
      signRunToken({ userId: "u1", plan: "pro", providers: ["openai"], fallback: { provider: "anthropic", model: "claude-haiku-4-5" } }),
    );
    expect(withFb.ok).toBe(true);
    expect(withFb.payload?.f).toEqual({ provider: "anthropic", model: "claude-haiku-4-5" });

    const noFb = verifyRunToken(signRunToken({ userId: "u1", plan: "pro", providers: ["openai"], fallback: null }));
    expect(noFb.ok).toBe(true);
    expect(noFb.payload?.f).toBeUndefined();
  });

  it("rejects a missing token", async () => {
    const { verifyRunToken } = await mod();
    expect(verifyRunToken(undefined).ok).toBe(false);
    expect(verifyRunToken("").ok).toBe(false);
    expect(verifyRunToken("no-dot").ok).toBe(false);
  });

  it("rejects a tampered payload (signature mismatch)", async () => {
    const { signRunToken, verifyRunToken } = await mod();
    const token = signRunToken({ userId: "u1", plan: "free", providers: ["openai"] });
    const [, mac] = token.split(".", 2);
    // Forge a free→career upgrade in the payload while keeping the old signature.
    const forgedBody = Buffer.from(
      JSON.stringify({ u: "u1", plan: "career", p: ["openai"], exp: Date.now() + 60_000 }),
      "utf8"
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(verifyRunToken(`${forgedBody}.${mac}`).ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    const { verifyRunToken } = await mod();
    const { createHmac } = await import("node:crypto");
    const b64 = (b: Buffer) =>
      b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const body = b64(
      Buffer.from(JSON.stringify({ u: "u1", plan: "pro", p: ["openai"], exp: Date.now() - 1000 }), "utf8")
    );
    const mac = b64(createHmac("sha256", process.env.AUTH_SECRET!).update(body).digest());
    expect(verifyRunToken(`${body}.${mac}`).ok).toBe(false);
  });
});
