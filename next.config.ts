import type { NextConfig } from "next";

/**
 * The pages are prerendered at build time (static, served from Vercel's CDN);
 * only the API routes under src/app/api/ run on the server (accounts and
 * progress, stored in MongoDB Atlas).
 */
const nextConfig: NextConfig = {
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
