import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import Shell from "@/components/Shell";
import { SITE_NAME } from "@/lib/data";
import "./globals.css";

const font = Readex_Pro({ subsets: ["arabic", "latin"], display: "swap" });

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "مشاهدة آمنة بلا إعلانات",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0f1a24",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={font.className}>
        <a href="#main" className="skip">تخطَّ إلى المحتوى</a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
