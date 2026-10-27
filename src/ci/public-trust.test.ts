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

  it("uses the owner-confirmed contact without publishing unverified mailboxes", () => {
    expect(COMPANY.legalEntity).toBe("Bogini");
    expect(COMPANY.address).toBe("Porto, Portugal");
    expect(COMPANY.contactUrl).toBe("https://www.instagram.com/orire.app/");
    expect(COMPANY.contactLabel).toBe("@orire.app");
    for (const path of ["privacy", "terms", "support"]) {
      const page = source(`src/app/${path}/page.tsx`);
      expect(page).toContain("COMPANY.contactUrl");
      expect(page).not.toContain("COMPANY.supportEmail");
      expect(page).not.toContain("COMPANY.privacyEmail");
    }
  });

  it("preserves distinct canonical URLs for the two policies", () => {
    expect(privacyMetadata.alternates?.canonical).toBe("/privacy");
    expect(termsMetadata.alternates?.canonical).toBe("/terms");
    expect(privacyMetadata.title).not.toEqual(termsMetadata.title);
  });
});
