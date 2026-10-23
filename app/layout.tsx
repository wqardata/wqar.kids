import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import Shell from "@/components/Shell";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/data";
import "./globals.css";

const font = Readex_Pro({ subsets: ["arabic", "latin"], display: "swap" });

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
      <body className={font.className}>
        <a href="#main" className="skip">تخطَّ إلى المحتوى</a>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
