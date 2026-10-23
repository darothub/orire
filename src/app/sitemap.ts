import type { MetadataRoute } from "next";
import { TEMPLATE_CATALOG } from "@/lib/templates/catalog";
import { GUIDES, isPublishedGuide } from "@/lib/content/guides";

import { SITE_URL } from "@/lib/seo/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const base = SITE_URL.replace(/\/+$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/templates`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/guides`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/support`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];

  const templateRoutes: MetadataRoute.Sitemap = TEMPLATE_CATALOG.map((t) => ({
    url: `${base}/templates/${t.id}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const guideRoutes: MetadataRoute.Sitemap = GUIDES.filter((g) => isPublishedGuide(g.slug)).map((g) => ({
    url: `${base}/guides/${g.slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...templateRoutes, ...guideRoutes];
}
