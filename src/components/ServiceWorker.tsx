"use client";
/**
 * Registers the service worker (src/sw/worker.ts, served at /serwist/sw.js) in production builds,
 * so the app opens and works without a connection. Not in `next dev`: its pages change constantly.
 */
import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

export function ServiceWorker({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      // Coming back online must not reload the page in the middle of an exercise.
      reloadOnOnline={false}
      options={{ scope: "/", type: "classic" }}
    >
      {children}
    </SerwistProvider>
  );
}
