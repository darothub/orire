import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Canonicalise www -> apex so the site is not served on two hosts (duplicate
  // content). The apex matches og:url / metadataBase. If the primary domain is
  // ever flipped in the Vercel dashboard, update this rule to match.
  async redirects() {
    return [
      // v4 was previewed at /v4; keep old links and bookmarks working.
      { source: "/v4", destination: "/app", permanent: false },
      { source: "/v4/:path*", destination: "/app/:path*", permanent: false },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.orire.app" }],
        destination: "https://orire.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
