"use client";
/**
 * What every page runs inside: TanStack Query's client (lib/query.ts), motion (only its basic
 * animation features, loaded once; none at all when the system asks for reduced motion) and the
 * service worker's registration.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";
import { getQueryClient } from "@/lib/query";
import { ServiceWorker } from "./ServiceWorker";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          <ServiceWorker>{children}</ServiceWorker>
        </LazyMotion>
      </MotionConfig>
    </QueryClientProvider>
  );
}
