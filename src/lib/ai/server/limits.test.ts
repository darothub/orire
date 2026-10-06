import { afterEach, describe, expect, it } from "vitest";
import { bodyTooLarge, validateInputSize, limits } from "./limits";

/** Minimal Request-like stub carrying a content-length header. */
function req(contentLength: string | null) {
  return { headers: { get: (name: string) => (name === "content-length" ? contentLength : null) } };
}

const ENV_KEYS = [
  "AI_MAX_BODY_BYTES",
  "AI_MAX_JD_CHARS",
  "AI_MAX_TEXT_CHARS",
  "AI_MAX_CV_CHARS",
  "AI_MAX_CANDIDATES",
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("bodyTooLarge", () => {
  it("allows a request with no content-length header", () => {
    expect(bodyTooLarge(req(null))).toBeNull();
  });

  it("allows a non-numeric content-length", () => {
    expect(bodyTooLarge(req("not-a-number"))).toBeNull();
  });

  it("allows a body within the cap", () => {
    process.env.AI_MAX_BODY_BYTES = "1000";
    expect(bodyTooLarge(req("500"))).toBeNull();
  });

  it("rejects a body over the cap with a descriptive message", () => {
    process.env.AI_MAX_BODY_BYTES = "1000";
    const msg = bodyTooLarge(req("2000"));
    expect(msg).toContain("too large");
    expect(msg).toContain("2000");
    expect(msg).toContain("1000");
  });
});

describe("validateInputSize", () => {
  it("passes when nothing is present", () => {
    expect(validateInputSize({})).toBeNull();
  });

  it("passes realistic CV + JD payloads", () => {
    expect(
      validateInputSize({
        jobDescription: "Senior engineer ".repeat(100),
        cv: { name: "Ada", experience: [{ role: "Eng" }] },
      }),
    ).toBeNull();
  });

  it("rejects an over-long job description", () => {
    process.env.AI_MAX_JD_CHARS = "10";
    const msg = validateInputSize({ jobDescription: "x".repeat(50) });
    expect(msg).toContain("Job description too long");
  });

  it("rejects over-long raw uploaded text", () => {
    process.env.AI_MAX_TEXT_CHARS = "10";
    expect(validateInputSize({ text: "y".repeat(50) })).toContain("Uploaded CV text too long");
  });

  it("rejects an over-large CV payload by serialized size", () => {
    process.env.AI_MAX_CV_CHARS = "20";
    expect(validateInputSize({ cv: { blob: "z".repeat(100) } })).toContain("CV payload too large");
  });

  it("rejects too many candidates", () => {
    process.env.AI_MAX_CANDIDATES = "2";
    const msg = validateInputSize({ candidates: [{ cv: {} }, { cv: {} }, { cv: {} }] });
    expect(msg).toContain("Too many candidates");
  });

  it("rejects a single over-large candidate CV", () => {
    process.env.AI_MAX_CV_CHARS = "20";
    const msg = validateInputSize({ candidates: [{ cv: { blob: "z".repeat(100) } }] });
    expect(msg).toContain("candidate CV is too large");
  });

  it("ignores a non-array candidates value (route does shape checks)", () => {
    expect(validateInputSize({ candidates: "nope" })).toBeNull();
  });

  it("honors env overrides at call time via the limits getters", () => {
    expect(limits.jobDescriptionChars()).toBe(20_000);
    process.env.AI_MAX_JD_CHARS = "5";
    expect(limits.jobDescriptionChars()).toBe(5);
  });
});
