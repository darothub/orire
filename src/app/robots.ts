import type { MetadataRoute } from "next";

const SITE_URL = process.env.APP_URL ?? "https://orire.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep API, auth and checkout flows out of the index.
      disallow: ["/api/", "/checkout/", "/forgot", "/reset"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
