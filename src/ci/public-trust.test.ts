import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANY } from "@/lib/legal/company";
import { metadata as privacyMetadata } from "@/app/privacy/page";
import { metadata as termsMetadata } from "@/app/terms/page";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/** UX95: contact and discoverability safeguards, not legal-compliance certification. */
describe("public privacy and support discoverability", () => {
  it("exposes policy and support destinations in the public footer", () => {
    const landing = source("src/components/landing/Landing.tsx");
    for (const path of ["/privacy", "/terms", "/support"]) {
      expect(landing).toContain(`href="${path}"`);
    }
  });

  it("maintains valid, separate privacy and support contact channels", () => {
    expect(COMPANY.privacyEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(COMPANY.supportEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(COMPANY.privacyEmail).not.toBe(COMPANY.supportEmail);
    const support = source("src/app/support/page.tsx");
    expect(support).toContain("COMPANY.supportEmail");
    expect(support).toContain('href={`mailto:${COMPANY.supportEmail}`}');
    expect(support).toContain('href="/privacy"');
    expect(support).toContain('href="/terms"');
  });

  it("preserves distinct canonical URLs for the two policies", () => {
    expect(privacyMetadata.alternates?.canonical).toBe("/privacy");
    expect(termsMetadata.alternates?.canonical).toBe("/terms");
    expect(privacyMetadata.title).not.toEqual(termsMetadata.title);
  });
});
