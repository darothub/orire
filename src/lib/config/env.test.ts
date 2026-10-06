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

  it("warns and names the absent keys when a group is partial", () => {
    const r = checkEnv({ ...validEnv(), AUTH_GOOGLE_ID: "id" });
    expect(r.ok).toBe(true); // feature config never blocks boot
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("Google OAuth");
    expect(r.warnings[0]).toContain("AUTH_GOOGLE_SECRET");
  });

  it("warns independently for multiple partial groups", () => {
    const r = checkEnv({ ...validEnv(), STRIPE_SECRET_KEY: "sk", MAIL_SMTP_HOST: "smtp" });
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings.join("\n")).toContain("Stripe billing");
    expect(r.warnings.join("\n")).toContain("SMTP mail");
  });

  it("covers every declared feature group with a partial config", () => {
    for (const group of FEATURE_GROUPS) {
      const env: EnvRecord = { ...validEnv(), [group.keys[0]]: "v" };
      const r = checkEnv(env);
      expect(r.warnings.some((w) => w.includes(group.name))).toBe(true);
    }
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
