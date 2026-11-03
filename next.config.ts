import type { NextConfig } from "next";

/**
 * Sinophile is a 100% static site: `next build` emits plain HTML/JS into `out/`,
 * which Vercel serves from its CDN. No server features are used.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
