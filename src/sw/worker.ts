/// <reference lib="webworker" />
/**
 * The service worker (Serwist), built by src/app/serwist/[path]/route.ts into /serwist/sw.js and
 * registered by components/ServiceWorker.tsx, so the app works without a connection:
 *
 * - at install it precaches the build's scripts, styles and fonts, the files in public/ (lesson
 *   exercises, stroke data, icons) and the offline page, and downloads every page (pages.ts);
 * - pages: network first, the cached copy when offline (any ?parameters share one copy);
 * - the API: always the network (guest mode works offline; an account's changes wait for the
 *   connection in lib/account/saver.ts);
 * - the dictionary (CC-CEDICT, 7 MB) is kept after its first download;
 * - the rest: Serwist's defaults for Next.js (static assets cache first, images and fonts
 *   stale-while-revalidate…).
 */
import { defaultCache } from "@serwist/turbopack/worker";
import {
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";
import { OFFLINE_FALLBACK, OFFLINE_PAGES, PAGES_CACHE } from "./pages";
import { isApi, isDictionary, isDocument, isPage } from "./requests";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: isApi, handler: new NetworkOnly() },
    {
      matcher: isPage,
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        networkTimeoutSeconds: 5,
        matchOptions: { ignoreSearch: true },
      }),
    },
    { matcher: isDictionary, handler: new StaleWhileRevalidate({ cacheName: "dictionary" }) },
    ...defaultCache,
  ],
  fallbacks: { entries: [{ url: OFFLINE_FALLBACK, matcher: isDocument }] },
});

/** Downloads every page; one that fails (a flaky connection) is cached on its first visit instead. */
async function cachePages(): Promise<void> {
  const cache = await caches.open(PAGES_CACHE);
  await Promise.allSettled(OFFLINE_PAGES.map((page) => cache.add(page)));
}

self.addEventListener("install", (event) => event.waitUntil(cachePages()));
serwist.addEventListeners();
