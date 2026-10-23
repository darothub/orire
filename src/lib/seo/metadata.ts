import type { Metadata } from "next";

/** Keep canonical and social URLs aligned, including deployments with APP_URL. */
export const SITE_URL = (process.env.APP_URL ?? "https://orire.app").replace(/\/+$/, "");

export function publicMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Orire",
      title,
      description,
      url: path,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function privateMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false, nocache: true },
    // Do not inherit the public homepage canonical on account-only pages.
    alternates: { canonical: null },
  };
}
