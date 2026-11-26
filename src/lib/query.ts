/**
 * TanStack Query's client. In the browser there is one for the whole tab, shared by the
 * components (through Providers.tsx) and by code outside React (the stroke loader HanziWriter
 * calls); on the server, a new one each time.
 *
 * What it loads is static data (exercises, CC-CEDICT, stroke order) or a translation of a fixed
 * text: nothing goes stale, nothing is refetched on focus or reconnection, and a failed download
 * is retried once.
 */
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  return (browserClient ??= makeQueryClient());
}
