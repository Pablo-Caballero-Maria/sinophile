import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/ServiceWorker";
import { AppShell } from "@/components/Shell";
import { VercelTelemetry } from "@/components/VercelTelemetry";
import { THEME_COLORS } from "@/lib/settings/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "sinophile · aprende chino", template: "%s · sinophile" },
  description:
    "Practica tu vocabulario de chino mandarín: lecciones, escritura de hanzi, pronunciación, exámenes y diccionario.",
  applicationName: "sinophile",
  appleWebApp: { capable: true, title: "sinophile", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The light theme's; applyTheme (lib/settings/theme.ts) switches it with the theme.
  themeColor: THEME_COLORS.light,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <body className="min-h-dvh">
        <ServiceWorker>
          <AppShell>{children}</AppShell>
        </ServiceWorker>
        <VercelTelemetry />
      </body>
    </html>
  );
}
