import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.nameAr,
    short_name: site.nameAr,
    description: site.description,
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#050505",
    // Icons are the official AB mark on white (scripts/build-brand-assets.mjs)
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
