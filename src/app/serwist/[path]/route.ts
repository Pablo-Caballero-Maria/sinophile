/**
 * /serwist/sw.js (and its source map): the service worker, src/sw/worker.ts bundled by esbuild at
 * build time with the list of files to precache (Serwist's Turbopack integration). Static: built
 * once by `next build`, served from the CDN with `Service-Worker-Allowed: /` so it can control the
 * whole site.
 */
import { createSerwistRoute } from "@serwist/turbopack";
import { OFFLINE_FALLBACK } from "@/sw/pages";
import { buildRevision } from "@/sw/revision";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/sw/worker.ts",
  useNativeEsbuild: true,
  additionalPrecacheEntries: [{ url: OFFLINE_FALLBACK, revision: buildRevision() }],
  // CC-CEDICT is too big to download at install: the worker keeps it after its first use.
  globIgnores: ["**/node_modules/**/*", "public/data/cedict.json"],
  // A classic script (not a module): every browser with service workers can run it.
  esbuildOptions: { format: "iife" },
});
