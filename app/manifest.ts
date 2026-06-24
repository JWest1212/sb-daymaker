import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SB Daymaker",
    short_name: "SB Daymaker",
    description:
      "Find what's worth doing in Santa Barbara today — find it, save it, share it.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6F1E7",
    theme_color: "#F6F1E7",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
