/**
 * The pages the service worker downloads when it installs, so the whole app opens without a
 * connection even before a page was visited. They are static (the account's data comes from the
 * API afterwards), and the ones with parameters (?id=, ?hanzi=…) read them in the browser, so one
 * copy of each serves every parameter.
 */
export const OFFLINE_PAGES = [
  "/",
  "/practicar",
  "/diccionario",
  "/progreso",
  "/ajustes",
  "/cuenta",
  "/leccion",
  "/palabra",
  "/sesion",
];

/** Shown for a page that isn't in the cache while offline (src/app/~offline/page.tsx). */
export const OFFLINE_FALLBACK = "/~offline";

/** Cache of the pages (network first: online, a page is always the newest). */
export const PAGES_CACHE = "pages";
