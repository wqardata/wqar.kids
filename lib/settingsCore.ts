// منطق الإعدادات النقي (بلا "use client") ليعمل في الخادم والمتصفح معًا.
import { CONTACT_EMAIL, LIVE_URL, MENU_ICONS, SITE_DESCRIPTION, SITE_NAME, SUPPORT_LINKS, type IconName } from "./data";
import { DEFAULT_THEME, cleanTheme, type Theme } from "./theme";

/** خطوط اسم الموقع. تُحمَّل من layout.tsx ولا تُنزَّل إلا عند استعمالها. */
export const BRAND_FONTS = [
  { id: "default", label: "خط الموقع (Readex Pro)", css: "" },
  { id: "cairo", label: "Cairo — عصري واضح", css: "var(--font-cairo), sans-serif" },
  { id: "tajawal", label: "Tajawal — بسيط", css: "var(--font-tajawal), sans-serif" },
  { id: "changa", label: "Changa — عريض للعناوين", css: "var(--font-changa), sans-serif" },
  { id: "reemkufi", label: "Reem Kufi — كوفي", css: "var(--font-reemkufi), sans-serif" },
  { id: "amiri", label: "Amiri — نسخ تقليدي", css: "var(--font-amiri), serif" },
] as const;
export type BrandFontId = (typeof BRAND_FONTS)[number]["id"];
export const BRAND_SIZE_MIN = 16;
export const BRAND_SIZE_MAX = 32;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** تخصيص عنصر قائمة: الاسم والأيقونة (المفتاح هو مسار الصفحة مثل "/shorts"). */
export type NavOverride = { label: string; icon: IconName };
export type NavOverrides = Record<string, NavOverride>;

export type SupportLink = { label: string; href: string };
export type SiteSettings = {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  liveUrl: string;
  supportLinks: SupportLink[];
  /** الشعار كصورة data: صغيرة محفوظة داخل Firestore (فارغ = بلا شعار). */
  logo: string;
  logoHeight: number;
  showName: boolean;
  /** لون الاسم في الوضعين الفاتح والداكن (فارغ = لون الموقع الافتراضي). */
  brandColor: string;
  brandColorDark: string;
  brandSize: number;
  brandFont: BrandFontId;
  /** ألوان الموقع والخطوط والحجم الأساسي. */
  theme: Theme;
  /** أسماء وأيقونات القائمة المخصّصة (فارغ = الافتراضي). */
  navItems: NavOverrides;
};

/** القيم الافتراضية (من lib/data.ts) تُستخدم حتى تُحفظ إعدادات في Firestore. */
export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: SITE_NAME,
  siteDescription: SITE_DESCRIPTION,
  contactEmail: CONTACT_EMAIL,
  liveUrl: LIVE_URL,
  supportLinks: SUPPORT_LINKS.map((l) => ({ ...l })),
  logo: "",
  logoHeight: 32,
  showName: true,
  brandColor: "",
  brandColorDark: "",
  brandSize: 22,
  brandFont: "default",
  theme: DEFAULT_THEME,
  navItems: {},
};

export const LOGO_MIN = 20;
export const LOGO_MAX = 44;
const LOGO_RE = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;

function cleanLogo(v: unknown): string {
  return typeof v === "string" && v.length <= 300_000 && LOGO_RE.test(v) ? v : "";
}

/** يقبل روابط http/https فقط (يمنع javascript: وغيره). */
export function cleanUrl(s: string): string {
  const t = s.trim();
  if (!t) return "";
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function cleanNav(v: unknown): NavOverrides {
  const out: NavOverrides = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [href, raw] of Object.entries(v as Record<string, unknown>)) {
    const o = (raw ?? {}) as { label?: unknown; icon?: unknown };
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 24) : "";
    const icon = MENU_ICONS.find((i) => i === o.icon);
    if (href.startsWith("/") && href.length <= 40 && label && icon) out[href] = { label, icon };
  }
  return out;
}

export function merge(d: Record<string, unknown>): SiteSettings {
  const str = (k: string, fallback: string) => (typeof d[k] === "string" ? (d[k] as string) : fallback);
  const links = Array.isArray(d.supportLinks)
    ? (d.supportLinks as unknown[])
        .map((x) => {
          const o = x as { label?: unknown; href?: unknown };
          return { label: typeof o?.label === "string" ? o.label : "", href: typeof o?.href === "string" ? cleanUrl(o.href) : "" };
        })
        .filter((l) => l.label && l.href)
    : DEFAULT_SETTINGS.supportLinks;
  return {
    siteName: str("siteName", DEFAULT_SETTINGS.siteName).trim() || DEFAULT_SETTINGS.siteName,
    siteDescription: str("siteDescription", DEFAULT_SETTINGS.siteDescription),
    contactEmail: str("contactEmail", DEFAULT_SETTINGS.contactEmail).trim(),
    liveUrl: cleanUrl(str("liveUrl", DEFAULT_SETTINGS.liveUrl)),
    supportLinks: links,
    logo: cleanLogo(d.logo),
    logoHeight: Math.min(LOGO_MAX, Math.max(LOGO_MIN, Math.round(Number(d.logoHeight) || DEFAULT_SETTINGS.logoHeight))),
    showName: d.showName !== false,
    brandColor: typeof d.brandColor === "string" && HEX.test(d.brandColor) ? d.brandColor : "",
    brandColorDark: typeof d.brandColorDark === "string" && HEX.test(d.brandColorDark) ? d.brandColorDark : "",
    brandSize: Math.min(BRAND_SIZE_MAX, Math.max(BRAND_SIZE_MIN, Math.round(Number(d.brandSize) || DEFAULT_SETTINGS.brandSize))),
    brandFont: BRAND_FONTS.some((f) => f.id === d.brandFont) ? (d.brandFont as BrandFontId) : "default",
    theme: cleanTheme(d.theme),
    navItems: cleanNav(d.navItems),
  };
}

