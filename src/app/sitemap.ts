import type { MetadataRoute } from "next";
import { TEMPLATE_CATALOG } from "@/lib/templates/catalog";
import { GUIDES, isPublishedGuide } from "@/lib/content/guides";

import { SITE_URL } from "@/lib/seo/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  // Do not claim every public page was edited on each sitemap request.
  // Add lastModified only when a trustworthy per-page update date exists.
  const base = SITE_URL.replace(/\/+$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/templates`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/guides`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/support`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const templateRoutes: MetadataRoute.Sitemap = TEMPLATE_CATALOG.map((t) => ({
    url: `${base}/templates/${t.id}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const guideRoutes: MetadataRoute.Sitemap = GUIDES.filter((g) => isPublishedGuide(g.slug)).map((g) => ({
    url: `${base}/guides/${g.slug}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...templateRoutes, ...guideRoutes];
}
