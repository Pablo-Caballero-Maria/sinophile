import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel Web Analytics (visitas, sin cookies) y Speed Insights (Core Web Vitals de visitas reales).
 * Solo en los builds que hace Vercel (`VERCEL=1` al compilar): fuera de Vercel sus scripts
 * (`/_vercel/…`) no existen, así que en local y en la CI no se cargan.
 */
export function VercelTelemetry() {
  if (!process.env.VERCEL) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
