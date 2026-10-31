import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mould Tracker",
    short_name: "Moulds",
    description:
      "Find any mould: machine, production floor, workshop or Mould Room rack.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    prefer_related_applications: false,
    background_color: "#1B2B35",
    theme_color: "#1B2B35",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
