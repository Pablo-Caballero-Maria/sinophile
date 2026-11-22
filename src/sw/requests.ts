/**
 * Which requests the service worker (worker.ts) handles how. Pure functions of the request, so they
 * are tested without a service worker.
 */

/** What Serwist gives each runtime-caching matcher (the part used here). */
export interface RequestInfo {
  url: URL;
  request: Pick<Request, "mode" | "destination">;
  sameOrigin: boolean;
}

/** The app's API (accounts, progress, settings, Better Auth): always the network, never a cached copy. */
export const isApi = ({ url, sameOrigin }: RequestInfo): boolean =>
  sameOrigin && url.pathname.startsWith("/api/");

/** Opening or reloading one of the app's pages. */
export const isPage = ({ request, sameOrigin }: RequestInfo): boolean =>
  sameOrigin && request.mode === "navigate";

/** CC-CEDICT (7 MB): too big to download at install, kept once the dictionary has used it. */
export const isDictionary = ({ url, sameOrigin }: RequestInfo): boolean =>
  sameOrigin && url.pathname === "/data/cedict.json";

/** The fallback page is for documents only (a missing image or script just fails). */
export const isDocument = ({ request }: Pick<RequestInfo, "request">): boolean =>
  request.destination === "document";
