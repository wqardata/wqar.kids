import type { Metadata, Viewport } from "next";
import { Amiri, Cairo, Changa, Readex_Pro, Reem_Kufi, Tajawal } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { SettingsProvider } from "@/lib/settings";
import Shell from "@/components/Shell";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/data";
import "./globals.css";

const font = Readex_Pro({ subsets: ["arabic", "latin"], display: "swap" });
// خطوط اسم الموقع الاختيارية: بلا preload كي لا تُحمَّل على الجوال إلا عند اختيارها.
// ملاحظة: next/font يشترط كتابة الخيارات حرفيًا في كل استدعاء (لا spread ولا متغيرات).
const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-cairo" });
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["500", "700"], display: "swap", preload: false, variable: "--font-tajawal" });
const changa = Changa({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-changa" });
const reemkufi = Reem_Kufi({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-reemkufi" });
const amiri = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-amiri" });

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
