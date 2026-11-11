import { describe, it, expect } from "vitest";
import { passwordStrength } from "@/lib/auth/passwordStrength";

describe("passwordStrength", () => {
  it("is empty for no input", () => {
    expect(passwordStrength("").score).toBe(0);
  });
  it("caps short passwords at weak", () => {
    const r = passwordStrength("Ab1!");
    expect(r.score).toBe(1);
    expect(r.rules.find((x) => x.key === "length")?.met).toBe(false);
  });
  it("rates long mixed passwords as strong", () => {
    const r = passwordStrength("Correct-Horse-9-Battery");
    expect(r.score).toBe(4);
    expect(r.rules.every((x) => x.met)).toBe(true);
  });
  it("rates a plain 8-char password as fair", () => {
    expect(passwordStrength("abcdefgh").score).toBe(2);
  });
});
