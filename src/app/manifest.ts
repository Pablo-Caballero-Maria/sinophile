import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "sinophile · aprende chino",
    short_name: "sinophile",
    description: "Vocabulario de chino mandarín: lecciones, escritura, pronunciación y exámenes.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#d93a3f",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
