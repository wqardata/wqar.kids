"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import BrandMark from "@/components/BrandMark";
import InstallCard from "@/components/InstallCard";
import { fileToLogo } from "@/lib/logoFile";
import { DEFAULT_SETTINGS, GLASS_MAX, GLASS_MIN, INSTALL_POS_DESKTOP, INSTALL_POS_MOBILE, type InstallPosDesktop, type InstallPosMobile, type InstallSettings } from "@/lib/settingsCore";
import { applyGlass, BRAND_FONTS, BRAND_SIZE_MAX, BRAND_SIZE_MIN, brandStyle, cleanUrl, LOGO_MAX, LOGO_MIN, useSettings, type BrandFontId, type SiteSettings } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerForm } from "./sectionKit";
import { useSettingsOwner } from "./saveKit";

/** الحقول التي يحرّرها هذا القسم من إعدادات الموقع (لا يلمس غيرها عند الحفظ). */
const KEYS = ["siteName", "tabName", "siteDescription", "logo", "logoHeight", "showName", "brandFont", "brandSize", "brandColor", "brandColorDark", "glass", "contactEmail", "supportLinks", "install"] as const;
const pick = (s: SiteSettings) => Object.fromEntries(KEYS.map((k) => [k, s[k]])) as Pick<SiteSettings, (typeof KEYS)[number]>;

export default function SettingsTab() {
  const { settings, ready } = useSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  usePreviewDraft("settings", form);
  const patch = useMemo(() => pick(form), [form]);
  const { setError } = useSettingsOwner({
    patch,
    validate: () => {
      if (!form.siteName.trim()) return "اسم الموقع مطلوب.";
      if (form.supportLinks.some((l) => (l.label.trim() || l.href.trim()) && (!l.label.trim() || !cleanUrl(l.href)))) {
        return "كل رابط دعم يحتاج اسمًا ورابطًا يبدأ بـ https://";
      }
      if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) return "البريد الإلكتروني غير صالح.";
      return "";
    },
    afterSave: (saved) => setForm((f) => ({ ...f, ...pick(saved) })),
    reset: () => setForm((f) => ({ ...f, ...pick(DEFAULT_SETTINGS) })),
  });

  // معاينة حيّة للزجاجية على الموقع نفسه أثناء تحريك المربع؛ إن لم تُحفظ تعود القيمة المحفوظة عند مغادرة التبويب.
  const savedGlass = useRef(settings.glass);
  savedGlass.current = settings.glass;
  useEffect(() => {
    applyGlass(form.glass);
  }, [form.glass]);
  useEffect(() => () => applyGlass(savedGlass.current), []);

  const setInstall = <K extends keyof InstallSettings>(k: K, v: InstallSettings[K]) => {
    setForm((f) => ({ ...f, install: { ...f.install, [k]: v } }));
  };

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };
  const setLink = (i: number, key: "label" | "href", v: string) =>
    set("supportLinks", form.supportLinks.map((l, j) => (j === i ? { ...l, [key]: v } : l)));

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      set("logo", await fileToLogo(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر رفع الصورة.");
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <OwnerForm>
      <MovableSection id="settings.info">
      <section className="panel auth-form" aria-labelledby="st-h-info">
        <h2 id="st-h-info">معلومات الموقع</h2>
      <div className="field">
        <label htmlFor="st-name">اسم الموقع في الصفحات (الهيدر وصفحة الدعم…)</label>
        <input id="st-name" value={form.siteName} onChange={(e) => set("siteName", e.target.value)} maxLength={60} required />
      </div>
      <div className="field">
        <label htmlFor="st-tab">اسم الموقع في تبويب المتصفح (فارغ = نفس الاسم أعلاه)</label>
        <input id="st-tab" value={form.tabName} placeholder={form.siteName} onChange={(e) => set("tabName", e.target.value)} maxLength={60} />
        <p className="hint">يظهر في عنوان التبويب وعند تثبيت الموقع على الجهاز، ولا يغيّر الاسم المعروض داخل الصفحات.</p>
      </div>
      <div className="field">
        <label htmlFor="st-desc">وصف الموقع</label>
        <input id="st-desc" value={form.siteDescription} onChange={(e) => set("siteDescription", e.target.value)} maxLength={160} />
      </div>

      </section>
      </MovableSection>

      <MovableSection id="settings.logo">
      <section className="panel auth-form" aria-labelledby="st-h-logo">
        <h2 id="st-h-logo">الشعار (يظهر في الهيدر)</h2>
      <div className="logo-box">
        <div className="logo-preview" aria-label="معاينة الهيدر">
          <span className="brand" style={brandStyle(form)}><BrandMark s={form} /></span>
        </div>
        <div className="addrow">
          <label className="btn btn--ghost btn--sm filebtn">
            {form.logo ? "تغيير الشعار" : "رفع شعار"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void onLogo(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {form.logo && (
            <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => set("logo", "")}>إزالة الشعار</button>
          )}
        </div>
        {form.logo && (
          <>
            <div className="field">
              <label htmlFor="st-logo-h">حجم الشعار: {form.logoHeight}px</label>
              <input id="st-logo-h" type="range" min={LOGO_MIN} max={LOGO_MAX} value={form.logoHeight} onChange={(e) => set("logoHeight", Number(e.target.value))} />
            </div>
            <label className="check"><input type="checkbox" checked={form.showName} onChange={(e) => set("showName", e.target.checked)} /> إظهار اسم الموقع بجانب الشعار</label>
          </>
        )}
        <p className="hint">يُفضَّل شعار بخلفية شفافة (PNG أو SVG). يُصغَّر تلقائيًا ويظهر في الهيدر بعد الحفظ.</p>
      </div>

      </section>
      </MovableSection>

      <MovableSection id="settings.look">
      <section className="panel auth-form" aria-labelledby="st-h-look">
        <h2 id="st-h-look">مظهر الموقع (اسم الموقع)</h2>
      <div className="field">
        <label htmlFor="st-font">الخط</label>
        <select id="st-font" value={form.brandFont} onChange={(e) => set("brandFont", e.target.value as BrandFontId)}>
          {BRAND_FONTS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="st-size">حجم الاسم: {form.brandSize}px</label>
        <input id="st-size" type="range" min={BRAND_SIZE_MIN} max={BRAND_SIZE_MAX} value={form.brandSize} onChange={(e) => set("brandSize", Number(e.target.value))} />
      </div>
      <div className="two">
        <div className="field">
          <label htmlFor="st-col-l">اللون — الوضع الفاتح</label>
          <div className="colorrow">
            <input id="st-col-l" type="color" value={form.brandColor || "#087a68"} onChange={(e) => set("brandColor", e.target.value)} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set("brandColor", "")} disabled={!form.brandColor}>افتراضي</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="st-col-d">اللون — الوضع الداكن</label>
          <div className="colorrow">
            <input id="st-col-d" type="color" value={form.brandColorDark || "#2cc4a8"} onChange={(e) => set("brandColorDark", e.target.value)} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set("brandColorDark", "")} disabled={!form.brandColorDark}>افتراضي</button>
          </div>
        </div>
      </div>
      <p className="hint">الموقع يتبدّل بين الفاتح والداكن حسب إعداد جهاز الزائر، لذا اختر لونًا واضحًا في كل وضع.</p>

      </section>
      </MovableSection>

      <MovableSection id="settings.glass">
      <section className="panel auth-form" aria-labelledby="st-h-glass">
        <h2 id="st-h-glass">الزجاجية</h2>
        <p className="hint">تتحكم في مظهر الترويسة العلوية والشريط السفلي والقائمة الجانبية ونوافذ التثبيت والحساب: كلما زادت القيمة صارت أكثر شفافية وتمويهًا.</p>
        <div className="field">
          <label htmlFor="st-glass">
            قوة الزجاجية: {form.glass}%{form.glass === 0 ? " (معتمة)" : form.glass === 60 ? " (الافتراضي)" : form.glass === GLASS_MAX ? " (أقصى)" : ""}
          </label>
          <input id="st-glass" type="range" min={GLASS_MIN} max={GLASS_MAX} step={1} value={form.glass} onChange={(e) => set("glass", Number(e.target.value))} />
        </div>
        <div className="addrow">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => set("glass", 60)} disabled={form.glass === 60}>الافتراضي</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => set("glass", 0)} disabled={form.glass === 0}>بلا زجاجية</button>
        </div>
        <div className="glass-prev" aria-hidden="true">
          <div className="glass-prev-card"><strong>معاينة الزجاج</strong><br /><small>هكذا تبدو الترويسة والنوافذ فوق المحتوى</small></div>
        </div>
        <p className="hint">المعاينة تظهر مباشرة على الموقع نفسه (انظر الترويسة فوق)، ولا تُحفظ حتى تضغط «حفظ التغييرات».</p>
      </section>
      </MovableSection>

      <MovableSection id="settings.pages">
      <section className="panel auth-form" aria-labelledby="st-h-pages">
        <h2 id="st-h-pages">الصفحات وروابط الدعم</h2>
      <div className="field">
        <label htmlFor="st-mail">بريد استقبال «تواصل معنا» (فارغ = تعطيل النموذج)</label>
        <input id="st-mail" type="email" dir="ltr" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} maxLength={120} />
      </div>

      <fieldset className="links">
        <legend>روابط الدعم</legend>
        {form.supportLinks.map((l, i) => (
          <div className="addrow" key={i}>
            <input aria-label={`اسم الرابط ${i + 1}`} placeholder="الاسم" value={l.label} onChange={(e) => setLink(i, "label", e.target.value)} maxLength={60} />
            <input aria-label={`عنوان الرابط ${i + 1}`} dir="ltr" placeholder="https://" value={l.href} onChange={(e) => setLink(i, "href", e.target.value)} maxLength={300} />
            <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => set("supportLinks", form.supportLinks.filter((_, j) => j !== i))}>حذف</button>
          </div>
        ))}
        <button type="button" className="btn btn--ghost btn--sm" disabled={form.supportLinks.length >= 10}
          onClick={() => set("supportLinks", [...form.supportLinks, { label: "", href: "" }])}>＋ إضافة رابط</button>
      </fieldset>

      </section>
      </MovableSection>

      <MovableSection id="settings.app">
      <section className="panel auth-form" aria-labelledby="st-h-app">
        <h2 id="st-h-app">نافذة التطبيق</h2>
      <label className="check"><input type="checkbox" checked={form.install.enabled} onChange={(e) => setInstall("enabled", e.target.checked)} /> إظهار نافذة «ثبّت التطبيق» للزوار</label>
      {form.install.enabled && (
        <>
          <div className="two">
            <label className="check"><input type="checkbox" checked={form.install.mobile} onChange={(e) => setInstall("mobile", e.target.checked)} /> على الهاتف والتابلت</label>
            <label className="check"><input type="checkbox" checked={form.install.desktop} onChange={(e) => setInstall("desktop", e.target.checked)} /> على الكمبيوتر</label>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="in-pm">مكانها على الهاتف</label>
              <select id="in-pm" value={form.install.posMobile} onChange={(e) => setInstall("posMobile", e.target.value as InstallPosMobile)}>
                {INSTALL_POS_MOBILE.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="in-pd">مكانها على الكمبيوتر</label>
              <select id="in-pd" value={form.install.posDesktop} onChange={(e) => setInstall("posDesktop", e.target.value as InstallPosDesktop)}>
                {INSTALL_POS_DESKTOP.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="in-delay">تظهر بعد: {form.install.delaySec === 0 ? "فورًا" : `${form.install.delaySec} ثانية`}</label>
              <input id="in-delay" type="range" min={0} max={120} step={1} value={form.install.delaySec} onChange={(e) => setInstall("delaySec", Number(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="in-snooze">بعد إغلاقها تعود بعد: {form.install.snoozeDays === 0 ? "في كل زيارة" : `${form.install.snoozeDays} يوم`}</label>
              <input id="in-snooze" type="range" min={0} max={30} step={1} value={form.install.snoozeDays} onChange={(e) => setInstall("snoozeDays", Number(e.target.value))} />
            </div>
          </div>
          <label className="check"><input type="checkbox" checked={form.install.homeOnly} onChange={(e) => setInstall("homeOnly", e.target.checked)} /> تظهر في الصفحة الرئيسية فقط</label>
          <div className="field">
            <label htmlFor="in-title">العنوان</label>
            <input id="in-title" value={form.install.title} onChange={(e) => setInstall("title", e.target.value)} maxLength={60} />
          </div>
          <div className="field">
            <label htmlFor="in-sub">النص الفرعي</label>
            <input id="in-sub" value={form.install.subtitle} onChange={(e) => setInstall("subtitle", e.target.value)} maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="in-btn">نص زر التثبيت</label>
            <input id="in-btn" value={form.install.button} onChange={(e) => setInstall("button", e.target.value)} maxLength={30} />
            <p className="hint">اكتب {"{name}"} في أي نص ليُستبدل باسم الموقع.</p>
          </div>
        </>
      )}
      <p className="hint">أيقونة التبويب وأيقونة التطبيق عند تثبيته ثابتتان من ملفات الموقع (<code dir="ltr">public/icons</code>) ولا تُغيَّران من هنا.</p>
      <div className="field">
        <span>معاينة النافذة</span>
        <div className="install install--preview">
          <InstallCard install={form.install} name={form.tabName || form.siteName} canPrompt onClose={() => {}} />
        </div>
      </div>

      </section>
      </MovableSection>

    </OwnerForm>
  );
}
