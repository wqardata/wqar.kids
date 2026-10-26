"use client";
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { THEME_CACHE_KEY, THEME_STYLE_ID, effectiveColors, themeCss, type Theme } from "./theme";
import { isPreviewFrame } from "./previewFrame";
import { BRAND_FONTS, DEFAULT_SETTINGS, glassCss, merge, type SiteSettings } from "./settingsCore";

export * from "./settingsCore";

/** نمط اسم الموقع (الحجم والخط واللون بحسب الوضع الفاتح/الداكن). */
export function brandStyle(s: SiteSettings): CSSProperties {
  const st: Record<string, string | number> = { fontSize: s.brandSize };
  const f = BRAND_FONTS.find((x) => x.id === s.brandFont);
  if (f?.css) st.fontFamily = f.css;
  if (s.brandColor) st["--brand-l"] = s.brandColor;
  if (s.brandColorDark) st["--brand-d"] = s.brandColorDark;
  return st as CSSProperties;
}

// آخر نسخة قرأها المتصفح فعلًا من Firestore (وليس القيم الافتراضية). null = لم تُقرأ بعد.
let baseline: { settings: SiteSettings; exists: boolean } | null = null;

/**
 * يحفظ الإعدادات بعد تنظيفها ويعيد النسخة المنظّفة.
 * يكتب الحقول التي تغيّرت فقط (مقارنةً بما قُرئ من Firestore) كي لا تُمحى حقول أخرى كالشعار واسم الموقع
 * إن كانت نسخة الصفحة قديمة أو افتراضية؛ ويرفض الحفظ إن لم تُقرأ الإعدادات من Firestore بعد.
 */
export async function saveSettings(s: SiteSettings): Promise<SiteSettings> {
  const clean = merge({ ...s });
  if (!baseline) {
    // لم يكتمل تحميل الإعدادات: نحاول قراءتها الآن، فإن فشلت لا نكتب شيئًا.
    const snap = await getDoc(doc(getDb(), "settings", "site"));
    baseline = { settings: snap.exists() ? merge(snap.data()) : DEFAULT_SETTINGS, exists: snap.exists() };
  }
  const base = baseline;
  const changed: Record<string, unknown> = {};
  for (const k of Object.keys(clean) as (keyof SiteSettings)[]) {
    if (JSON.stringify(clean[k]) !== JSON.stringify(base.settings[k])) changed[k] = clean[k];
  }
  const ref = doc(getDb(), "settings", "site");
  if (base.exists) {
    try {
      await updateDoc(ref, { ...changed, updatedAt: serverTimestamp() });
    } catch (e) {
      if ((e as { code?: string })?.code !== "not-found") throw e;
      await setDoc(ref, { ...clean, updatedAt: serverTimestamp() });
    }
  } else {
    await setDoc(ref, { ...clean, updatedAt: serverTimestamp() });
  }
  baseline = { settings: clean, exists: true };
  // يُبطل نسخة الخادم المخزّنة كي يظهر الاسم/الشعار الجديد في التبويب وفي أول تحميل للجميع.
  try {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    if (token) await fetch("/api/revalidate-settings", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    /* لا يضرّ: ستتجدد النسخة تلقائيًا خلال دقائق */
  }
  return clean;
}

/** يكتب CSS الثيم في <style id="site-theme">، ويحدّث لون شريط المتصفح، ويحفظ نسخة محلية. */
export function applyTheme(theme: Theme, persist = true) {
  if (typeof document === "undefined") return;
  const css = themeCss(theme);
  let el = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = THEME_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const dark = (m.media || "").includes("dark");
    m.content = effectiveColors(theme, dark ? "dark" : "light").bg;
  });
  if (!persist) return;
  try {
    if (css) localStorage.setItem(THEME_CACHE_KEY, css);
    else localStorage.removeItem(THEME_CACHE_KEY);
  } catch {
    /* التخزين المحلي غير متاح (وضع خاص مثلًا): لا بأس */
  }
}

/** يكتب متغيرات الزجاجية في <style id="site-glass"> (يُستعمل للمعاينة الحيّة ولتحديث القيمة بعد تحميل الإعدادات). */
export function applyGlass(level: number) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("site-glass") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "site-glass";
    document.head.appendChild(el);
  }
  el.textContent = glassCss(level);
}

type Ctx = { settings: SiteSettings; update: (s: SiteSettings) => void; ready: boolean };
const SettingsCtx = createContext<Ctx | null>(null);

/** نسخة محلية من هوية الموقع (الاسم والشعار) تُعرض إن تعذّر Firebase (انتهاء الحد اليومي مثلًا). */
const IDENTITY_CACHE_KEY = "site-identity";
type IdentityCache = Pick<SiteSettings, "siteName" | "tabName" | "logo" | "logoHeight" | "showName">;
function readIdentity(): IdentityCache | null {
  try {
    const raw = localStorage.getItem(IDENTITY_CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Record<string, unknown>;
    // merge ينظّف القيم (طول الاسم، صيغة الشعار…) فلا نثق بالمخزَّن كما هو.
    const m = merge({ siteName: j.siteName, tabName: j.tabName, logo: j.logo, logoHeight: j.logoHeight, showName: j.showName });
    return { siteName: m.siteName, tabName: m.tabName, logo: m.logo, logoHeight: m.logoHeight, showName: m.showName };
  } catch {
    return null;
  }
}
function writeIdentity(s: SiteSettings) {
  try {
    localStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify({ siteName: s.siteName, tabName: s.tabName, logo: s.logo, logoHeight: s.logoHeight, showName: s.showName }));
  } catch {
    /* التخزين المحلي غير متاح: لا بأس */
  }
}

export function SettingsProvider({ children, initial }: { children: ReactNode; initial?: SiteSettings }) {
  // `initial` قادمة من الخادم: الاسم والشعار الصحيحان يظهران في أول HTML دون وميض القيم القديمة.
  const [settings, setSettings] = useState<SiteSettings>(initial ?? DEFAULT_SETTINGS);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  // لا نطبّق الثيم قبل معرفة ما في Firestore، كي لا نمسح النسخة المحلية ويحدث وميض بالألوان الافتراضية.
  const [themeKnown, setThemeKnown] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    // إن كان الخادم لم يجد الإعدادات (فعاد بالقيم الافتراضية) نعرض آخر هوية محفوظة في هذا المتصفح حتى يرد Firebase.
    const cached = readIdentity();
    if (cached) setSettings((s) => ({ ...s, ...cached }));
    getDoc(doc(getDb(), "settings", "site"))
      .then((snap) => {
        if (off) return;
        baseline = { settings: snap.exists() ? merge(snap.data()) : DEFAULT_SETTINGS, exists: snap.exists() };
        if (snap.exists()) {
          const fresh = merge(snap.data());
          setSettings(fresh);
          writeIdentity(fresh);
        }
        setThemeKnown(true);
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, []);

  // تطبيق الثيم على الصفحة وتخزينه محليًا ليظهر فورًا في الزيارة التالية دون وميض.
  useEffect(() => {
    if (themeKnown) applyTheme(settings.theme, !isPreviewFrame());
  }, [settings.theme, themeKnown]);

  // الزجاجية: الخادم كتبها في HTML الأول؛ هنا نزامنها مع آخر قيمة محفوظة.
  useEffect(() => {
    if (ready) applyGlass(settings.glass);
  }, [settings.glass, ready]);

  const value = useMemo<Ctx>(() => ({ settings, update: setSettings, ready }), [settings, ready]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const v = useContext(SettingsCtx);
  if (!v) throw new Error("useSettings must be used inside <SettingsProvider>");
  return v;
}
