import { describe, expect, it, vi } from "vitest";
import { GUIDES } from "@/lib/content/guides";
import { generateMetadata as guideMetadata } from "@/app/guides/[slug]/page";
import { metadata as supportMetadata } from "@/app/support/layout";
import { metadata as forgotMetadata } from "@/app/forgot/layout";
import { metadata as resetMetadata } from "@/app/reset/layout";
import { metadata as checkoutMetadata } from "@/app/checkout/layout";
import { privateMetadata, publicMetadata } from "./metadata";

vi.mock("@/lib/share/shared", () => ({
  getSharedCV: vi.fn().mockResolvedValue({ name: "Fictional applicant" }),
}));
import { generateMetadata as sharedMetadata } from "@/app/cv/[token]/page";

describe("route-specific social previews", () => {
  it("keeps canonical, OpenGraph and Twitter descriptions aligned", () => {
    const metadata = publicMetadata("A public page", "Accurate description", "/example");
    expect(metadata.alternates?.canonical).toBe("/example");
    expect(metadata.openGraph).toMatchObject({
      title: metadata.title, description: metadata.description, url: "/example",
    });
    expect(metadata.twitter).toMatchObject({
      title: metadata.title, description: metadata.description, card: "summary_large_image",
    });
  });

  it("gives every guide its own social preview", async () => {
    for (const guide of GUIDES) {
      const metadata = await guideMetadata({ params: Promise.resolve({ slug: guide.slug }) });
      expect(metadata.openGraph).toMatchObject({
        title: `${guide.title} | Orire`, description: guide.description, url: `/guides/${guide.slug}`,
      });
      expect(metadata.twitter).toMatchObject({ title: metadata.title, description: guide.description });
    }
  });

  it("keeps the support page social URL distinct from the homepage", () => {
    expect(supportMetadata.openGraph).toMatchObject({ url: "/support", title: "Support — Orire" });
  });
});

describe("private route indexing", () => {
  it("prevents recovery and checkout routes inheriting the homepage canonical", () => {
    for (const metadata of [forgotMetadata, resetMetadata, checkoutMetadata, privateMetadata("Private")]) {
      expect(metadata.robots).toMatchObject({ index: false, follow: false, nocache: true });
      expect(metadata.alternates?.canonical).toBeNull();
    }
  });

  it("preserves private-by-link CV noindex and removes the inherited canonical", async () => {
    const metadata = await sharedMetadata({ params: Promise.resolve({ token: "fictional-token" }) });
    expect(metadata.robots).toMatchObject({ index: false, follow: false, nocache: true });
    expect(metadata.alternates?.canonical).toBeNull();
  });
});
