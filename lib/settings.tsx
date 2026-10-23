"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import { CONTACT_EMAIL, LIVE_URL, SITE_DESCRIPTION, SITE_NAME, SUPPORT_LINKS } from "./data";

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

function merge(d: Record<string, unknown>): SiteSettings {
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
  };
}

/** يحفظ الإعدادات بعد تنظيفها ويعيد النسخة المنظّفة. */
export async function saveSettings(s: SiteSettings): Promise<SiteSettings> {
  const clean = merge({ ...s });
  await setDoc(doc(getDb(), "settings", "site"), { ...clean, updatedAt: serverTimestamp() });
  return clean;
}

type Ctx = { settings: SiteSettings; update: (s: SiteSettings) => void; ready: boolean };
const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDoc(doc(getDb(), "settings", "site"))
      .then((snap) => {
        if (!off && snap.exists()) setSettings(merge(snap.data()));
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, []);

  const value = useMemo<Ctx>(() => ({ settings, update: setSettings, ready }), [settings, ready]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const v = useContext(SettingsCtx);
  if (!v) throw new Error("useSettings must be used inside <SettingsProvider>");
  return v;
}
