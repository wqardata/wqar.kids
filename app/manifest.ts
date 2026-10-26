import type { MetadataRoute } from "next";
import { IDENTITY } from "@/lib/identity";
import { getServerSettings } from "@/lib/serverSettings";

export const revalidate = 300;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getServerSettings();
  const tab = s.tabName || s.siteName;
  const bg = s.install.appIconBg || "#0f1a24";
  const icons: MetadataRoute.Manifest["icons"] = [
    { src: IDENTITY.icon192, sizes: "192x192", type: "image/png" },
    { src: IDENTITY.icon512, sizes: "512x512", type: "image/png" },
    { src: IDENTITY.iconMaskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
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
