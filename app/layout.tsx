import type { Metadata, Viewport } from "next";
import { Amiri, Cairo, Changa, Readex_Pro, Reem_Kufi, Tajawal } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { SettingsProvider } from "@/lib/settings";
import Shell from "@/components/Shell";
import InstallPrompt from "@/components/InstallPrompt";
import Splash from "@/components/Splash";
import { getServerSettings, shortHash } from "@/lib/serverSettings";
import { themeCss } from "@/lib/theme";
import "./globals.css";

const font = Readex_Pro({ subsets: ["arabic", "latin"], display: "swap" });
// خطوط اسم الموقع الاختيارية: بلا preload كي لا تُحمَّل على الجوال إلا عند اختيارها.
// ملاحظة: next/font يشترط كتابة الخيارات حرفيًا في كل استدعاء (لا spread ولا متغيرات).
const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-cairo" });
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["500", "700"], display: "swap", preload: false, variable: "--font-tajawal" });
const changa = Changa({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-changa" });
const reemkufi = Reem_Kufi({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-reemkufi" });
const amiri = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-amiri" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getServerSettings();
  // الشعار المرفوع يصبح أيقونة التبويب؛ وإن لم يوجد شعار تُستخدم الأيقونة الافتراضية.
  const icon = s.logo ? `/api/logo?v=${shortHash(s.logo)}` : "/icons/icon-192.png";
  // اسم التبويب مستقل عن اسم الموقع داخل الصفحات (فارغ = نفس اسم الموقع).
  const tab = s.tabName || s.siteName;
  return {
    title: { default: tab, template: `%s | ${tab}` },
    description: s.siteDescription,
    applicationName: tab,
    icons: { icon, apple: s.install.appIconV > 0 ? `/api/app-icon?s=192&v=${s.install.appIconV}` : icon },
  };
}

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getServerSettings();
  const themeStyle = themeCss(settings.theme);
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* ثيم الموقع من الخادم داخل HTML نفسه (بلا وميض). النسخة المحلية احتياط إن تعذّر وصول الخادم لـ Firestore. */}
        {themeStyle && <style id="site-theme" dangerouslySetInnerHTML={{ __html: themeStyle }} />}
        {/* يلتقط حدث التثبيت مبكرًا (قد يصل قبل تحميل React) ليستعمله مكوّن InstallPrompt */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.__bip=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__bip=e;window.dispatchEvent(new Event("bip-ready"))});',
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var m=localStorage.getItem("color-mode");if(m==="light"||m==="dark")document.documentElement.setAttribute("data-theme",m);if(localStorage.getItem("side")==="mini")document.documentElement.setAttribute("data-side","mini");var c=document.getElementById("site-theme")?null:localStorage.getItem("site-theme-css");if(c){var s=document.createElement("style");s.id="site-theme";s.textContent=c;document.head.appendChild(s)}}catch(e){}',
          }}
        />
      </head>
      <body className={`${font.className} ${cairo.variable} ${tajawal.variable} ${changa.variable} ${reemkufi.variable} ${amiri.variable}`}>
        <a href="#main" className="skip">تخطَّ إلى المحتوى</a>
        <AuthProvider>
          <SettingsProvider initial={settings}>
            <Splash />
            <Shell>{children}</Shell>
            <InstallPrompt />
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
