import { describe, expect, it } from "vitest";
import {
  FEATURE_GROUPS,
  HARD_REQUIRED,
  checkEnv,
  formatEnvError,
  type EnvRecord,
} from "@/lib/config/env";

/** A complete, valid environment: every hard-required var set, no partial groups. */
function validEnv(): EnvRecord {
  return { AUTH_SECRET: "s3cret", DATABASE_URL: "postgres://localhost/orire" };
}

describe("checkEnv — hard-required", () => {
  it("passes when every hard-required var is present", () => {
    const r = checkEnv(validEnv());
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("reports each missing hard-required var", () => {
    const r = checkEnv({});
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([...HARD_REQUIRED]);
  });

  it("treats blank/whitespace values as missing", () => {
    const r = checkEnv({ AUTH_SECRET: "   ", DATABASE_URL: "" });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([...HARD_REQUIRED]);
  });

  it("reports only the var that is actually absent", () => {
    const r = checkEnv({ AUTH_SECRET: "x" });
    expect(r.missing).toEqual(["DATABASE_URL"]);
  });
});

describe("checkEnv — feature-group warnings", () => {
  it("does not warn when a group is fully unset", () => {
    const r = checkEnv(validEnv());
    expect(r.warnings).toEqual([]);
  });

  it("does not warn when a group is fully set", () => {
    const r = checkEnv({ ...validEnv(), AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "sec" });
    expect(r.warnings).toEqual([]);
  });

  it("does not warn for unauthenticated SMTP", () => {
    const r = checkEnv({ ...validEnv(), MAIL_SMTP_HOST: "localhost", MAIL_SMTP_PORT: "1025" });
    expect(r.warnings).toEqual([]);
  });

  it("does not warn when both optional SMTP auth values are set", () => {
    const r = checkEnv({ ...validEnv(), MAIL_SMTP_USER: "user", MAIL_SMTP_PASS: "pass" });
    expect(r.warnings).toEqual([]);
  });

  it("warns and names the absent keys when a group is partial", () => {
    const r = checkEnv({ ...validEnv(), AUTH_GOOGLE_ID: "id" });
    expect(r.ok).toBe(true); // feature config never blocks boot
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("Google OAuth");
    expect(r.warnings[0]).toContain("AUTH_GOOGLE_SECRET");
  });

  it("warns independently for multiple partial groups", () => {
    const r = checkEnv({ ...validEnv(), STRIPE_SECRET_KEY: "sk", MAIL_SMTP_USER: "user" });
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings.join("\n")).toContain("Stripe billing");
    expect(r.warnings.join("\n")).toContain("SMTP mail authentication");
    expect(r.warnings.join("\n")).toContain("MAIL_SMTP_PASS");
  });

  it("covers every declared feature group with a partial config", () => {
    for (const group of FEATURE_GROUPS) {
      const env: EnvRecord = { ...validEnv(), [group.keys[0]]: "v" };
      const r = checkEnv(env);
      expect(r.warnings.some((w) => w.includes(group.name))).toBe(true);
    }
  });

  it("warns in production when managed AI is live without a shared rate-limit store", () => {
    const r = checkEnv({
      ...validEnv(),
      NODE_ENV: "production",
      OPENAI_API_KEY: "sk-test",
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("Shared rate limiting is not configured"))).toBe(true);
  });

  it("does not warn about shared rate limiting when Upstash is fully set", () => {
    const r = checkEnv({
      ...validEnv(),
      NODE_ENV: "production",
      OPENAI_API_KEY: "sk-test",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "tok",
    });
    expect(r.warnings.some((w) => w.includes("Shared rate limiting"))).toBe(false);
  });

  it("does not warn about shared rate limiting outside production", () => {
    const r = checkEnv({
      ...validEnv(),
      NODE_ENV: "development",
      OPENAI_API_KEY: "sk-test",
    });
    expect(r.warnings.some((w) => w.includes("Shared rate limiting is not configured"))).toBe(false);
  });

  it("warns in production when CRON_SECRET is unset (the activation-nudge cron will never send)", () => {
    const r = checkEnv({ ...validEnv(), NODE_ENV: "production" });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("CRON_SECRET is not set"))).toBe(true);
  });

  it("does not warn about CRON_SECRET once it's set", () => {
    const r = checkEnv({ ...validEnv(), NODE_ENV: "production", CRON_SECRET: "s" });
    expect(r.warnings.some((w) => w.includes("CRON_SECRET"))).toBe(false);
  });

  it("does not warn about CRON_SECRET outside production", () => {
    const r = checkEnv({ ...validEnv(), NODE_ENV: "development" });
    expect(r.warnings.some((w) => w.includes("CRON_SECRET"))).toBe(false);
  });
});

describe("formatEnvError", () => {
  it("summarizes missing vars and warnings together", () => {
    const msg = formatEnvError({
      ok: false,
      missing: ["AUTH_SECRET"],
      warnings: ["Stripe billing is partially configured; missing: STRIPE_WEBHOOK_SECRET"],
    });
    expect(msg).toContain("Missing required environment variables: AUTH_SECRET");
    expect(msg).toContain("Warning: Stripe billing is partially configured");
  });

  it("returns an empty string for a clean result", () => {
    expect(formatEnvError({ ok: true, missing: [], warnings: [] })).toBe("");
  });
});
