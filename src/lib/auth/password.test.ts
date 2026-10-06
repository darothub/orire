import { describe, it, expect } from "vitest";
import { validatePassword, validateCredentials, MIN_PASSWORD_LENGTH } from "./password";

describe("validatePassword", () => {
  it("rejects weak/common passwords", () => {
    expect(validatePassword("12345678")).not.toBeNull(); // too short + sequence
    expect(validatePassword("123456789")).not.toBeNull(); // sequence
    expect(validatePassword("password")).not.toBeNull(); // too short
    expect(validatePassword("password123")).not.toBeNull(); // common
    expect(validatePassword("qwertyuiop")).not.toBeNull(); // common
    expect(validatePassword("aaaaaaaaaa")).not.toBeNull(); // repeated char
    expect(validatePassword("1234567890")).not.toBeNull(); // all numbers + sequence
    expect(validatePassword("0000000000")).not.toBeNull(); // repeated
  });

  it("rejects too-short passwords", () => {
    expect(validatePassword("Ab3xy")).toContain(`${MIN_PASSWORD_LENGTH}`);
  });

  it("rejects all-numeric passwords", () => {
    expect(validatePassword("4820571963")).not.toBeNull();
  });

  it("rejects passwords containing the email name", () => {
    expect(validatePassword("janedoe1234", "janedoe@example.com")).not.toBeNull();
  });

  it("requires a mix unless it's a long passphrase", () => {
    expect(validatePassword("abcdqwlkjh")).not.toBeNull(); // 10 letters, one class
    expect(validatePassword("correct horse battery staple")).toBeNull(); // 16+ passphrase
  });

  it("accepts a reasonably strong password", () => {
    expect(validatePassword("River7Maple")).toBeNull();
    expect(validatePassword("g7Kp2qLm9x")).toBeNull();
  });

  it("validateCredentials checks email too", () => {
    expect(validateCredentials("not-an-email", "River7Maple")).toContain("email");
    expect(validateCredentials("a@b.co", "River7Maple")).toBeNull();
  });
});
