import { describe, it, expect, beforeAll } from "vitest";
import { seal, open, maskSecret, secretBoxConfigured } from "./secretBox";

// A fixed strong secret so key derivation is deterministic within the suite.
beforeAll(() => {
  process.env.ORIRE_SECRET_KEY = "test-secret-key-for-orire-unit-tests-0001";
});

describe("secretBox", () => {
  it("reports configured when a strong secret is set", () => {
    expect(secretBoxConfigured()).toBe(true);
  });

  it("round-trips a secret through seal/open", () => {
    const secret = "sk-proj-abcdef0123456789";
    const sealed = seal(secret);
    expect(sealed.ciphertext).not.toContain(secret);
    expect(open(sealed)).toBe(secret);
  });

  it("produces a distinct iv each time (non-deterministic ciphertext)", () => {
    const a = seal("same-value");
    const b = seal("same-value");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(open(a)).toBe(open(b));
  });

  it("rejects a tampered ciphertext", () => {
    const sealed = seal("secret");
    const bad = { ...sealed, tag: Buffer.from("0".repeat(16)).toString("base64") };
    expect(() => open(bad)).toThrow();
  });

  it("masks a secret without revealing it", () => {
    expect(maskSecret("sk-proj-abcdef01234f2a")).toBe("sk-…4f2a");
    expect(maskSecret("short")).toBe("•••");
  });
});
