import type { Metadata, Viewport } from "next";
import { Amiri, Cairo, Changa, Readex_Pro, Reem_Kufi, Tajawal } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { SettingsProvider } from "@/lib/settings";
import Shell from "@/components/Shell";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/data";
import "./globals.css";

const font = Readex_Pro({ subsets: ["arabic", "latin"], display: "swap" });
// خطوط اسم الموقع الاختيارية: بلا preload كي لا تُحمَّل على الجوال إلا عند اختيارها.
const opt = { subsets: ["arabic", "latin"] as ("arabic" | "latin")[], display: "swap" as const, preload: false };
const cairo = Cairo({ ...opt, variable: "--font-cairo" });
const tajawal = Tajawal({ ...opt, weight: ["500", "700"], variable: "--font-tajawal" });
const changa = Changa({ ...opt, variable: "--font-changa" });
const reemkufi = Reem_Kufi({ ...opt, variable: "--font-reemkufi" });
const amiri = Amiri({ ...opt, weight: ["400", "700"], variable: "--font-amiri" });

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a24" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${font.className} ${cairo.variable} ${tajawal.variable} ${changa.variable} ${reemkufi.variable} ${amiri.variable}`}>
        <a href="#main" className="skip">تخطَّ إلى المحتوى</a>
        <AuthProvider>
          <SettingsProvider>
            <Shell>{children}</Shell>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
