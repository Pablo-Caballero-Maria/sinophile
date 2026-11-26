import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { deploymentOptions, securityHeaders, type SecurityOptions } from "./src/lib/security-headers";
import { STROKES_CDN } from "./src/lib/strokes-cdn";
import { TRANSLATION_HOSTS } from "./src/lib/translation-hosts";

/**
 * The pages are prerendered at build time (static, served from Vercel's CDN);
 * only the API routes under src/app/api/ run on the server (accounts and
 * progress, stored in MongoDB Atlas). withSerwist keeps esbuild, which builds
 * the service worker (src/app/serwist/[path]/route.ts), out of the server bundle.
 *
 * Every response carries the security headers of src/lib/security-headers.ts (Content Security
 * Policy, HSTS, no framing…).
 */

/** What sinophile needs on top of the base policy. */
const SITE_SECURITY: SecurityOptions = {
  extra: {
    // The translator (lib/translate.ts) and stroke data that isn't in /strokes (lib/strokes.ts).
    "connect-src": [...TRANSLATION_HOSTS, new URL(STROKES_CDN).origin],
    // Playing back what the learner just recorded (pronunciation exercises).
    "media-src": ["blob:"],
  },
  // Pronunciation exercises and dictation.
  allow: ["microphone"],
};

const baseConfig = (phase: string): NextConfig => ({
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const options = { ...SITE_SECURITY, ...deploymentOptions(), dev: phase === PHASE_DEVELOPMENT_SERVER };
    return [{ source: "/(.*)", headers: securityHeaders(options) }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
});

/** Next.js calls this with the phase it runs in (`next dev`, `next build`, `next start`…). */
const nextConfig = (phase: string): NextConfig => withSerwist(baseConfig(phase));

export default nextConfig;
