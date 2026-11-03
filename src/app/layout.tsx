import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/shell";
import { THEME_BOOT_SCRIPT } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "sinophile · aprende chino", template: "%s · sinophile" },
  description: "Practica tu vocabulario de chino mandarín: lecciones, escritura de hanzi, pronunciación, exámenes y diccionario.",
  applicationName: "sinophile",
  appleWebApp: { capable: true, title: "sinophile", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#121315" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
