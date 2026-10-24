import type { MetadataRoute } from "next";
import { getServerSettings } from "@/lib/serverSettings";

export const revalidate = 300;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getServerSettings();
  return {
    name: s.siteName,
    short_name: s.siteName.slice(0, 12),
    description: s.siteDescription,
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1a24",
    theme_color: "#0f1a24",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
