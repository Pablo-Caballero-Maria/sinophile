import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

/**
 * The pages are prerendered at build time (static, served from Vercel's CDN);
 * only the API routes under src/app/api/ run on the server (accounts and
 * progress, stored in MongoDB Atlas). withSerwist keeps esbuild, which builds
 * the service worker (src/app/serwist/[path]/route.ts), out of the server bundle.
 */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSerwist(nextConfig);
