import type { MetadataRoute } from "next";
import { getServerSettings } from "@/lib/serverSettings";

export const revalidate = 300;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getServerSettings();
  const tab = s.tabName || s.siteName;
  const v = s.install.appIconV;
  const bg = s.install.appIconBg || "#0f1a24";
  const icons: MetadataRoute.Manifest["icons"] = v > 0
    ? [
        { src: `/api/app-icon?s=192&v=${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `/api/app-icon?s=512&v=${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: `/api/app-icon?s=512&v=${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    : [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];
  return {
    name: tab,
    short_name: tab.slice(0, 12),
    description: s.siteDescription,
    lang: "ar",
    dir: "rtl",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: bg,
    theme_color: bg,
    icons,
  };
}
