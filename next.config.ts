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
