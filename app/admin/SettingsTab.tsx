"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import BrandMark from "@/components/BrandMark";
import InstallCard, { installIconSrc } from "@/components/InstallCard";
import { getDb } from "@/lib/firebase";
import { GLASS_MAX, GLASS_MIN, INSTALL_POS_DESKTOP, INSTALL_POS_MOBILE, type InstallPosDesktop, type InstallPosMobile, type InstallSettings } from "@/lib/settingsCore";
import { applyGlass, BRAND_FONTS, BRAND_SIZE_MAX, BRAND_SIZE_MIN, brandStyle, cleanUrl, LOGO_MAX, LOGO_MIN, saveSettings, useSettings, type BrandFontId, type SiteSettings } from "@/lib/settings";

/** يصغّر الصورة (حتى 512px) ويحوّلها إلى data: URL صغير؛ إعادة الرسم تزيل أي سكربت من SVG. */
async function fileToLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("اختر ملف صورة (PNG أو SVG أو JPG أو WebP).");
  if (file.size > 5 * 1024 * 1024) throw new Error("الصورة كبيرة؛ الحد الأقصى 5 ميغابايت.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("تعذّر قراءة الصورة."));
      i.src = url;
    });
    const w0 = img.naturalWidth || 512;
    const h0 = img.naturalHeight || 512;
    for (const max of [512, 256]) {
      const k = Math.min(1, max / Math.max(w0, h0));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w0 * k));
      c.height = Math.max(1, Math.round(h0 * k));
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL("image/webp", 0.9);
      if (out.length <= 250_000) return out;
    }
    throw new Error("الصورة معقّدة جدًا؛ جرّب صورة أبسط أو أصغر.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ICON_PAD = 0.64; // حجم الشعار داخل الأيقونة (هامش آمن لقصّ الأيقونات الدائرية)
const ICON_BG_DEFAULT = "#0f1a24";

/** يرسم الشعار في مربع PNG بلون خلفية، بحجم size. */
function makeIcon(img: HTMLImageElement, size: number, bg: string): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  const w0 = img.naturalWidth || 512, h0 = img.naturalHeight || 512;
  const k = (size * ICON_PAD) / Math.max(w0, h0);
  const w = w0 * k, h = h0 * k;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return c.toDataURL("image/png");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("اختر ملف صورة (PNG أو SVG أو JPG أو WebP)."));
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => { URL.revokeObjectURL(url); res(i); };
    i.onerror = () => { URL.revokeObjectURL(url); rej(new Error("تعذّر قراءة الصورة.")); };
    i.src = url;
  });
}

type PendingIcon = { png192: string; png512: string } | null;

export default function SettingsTab() {
  const { settings, update, ready } = useSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // أيقونة التطبيق المختارة ولم تُحفظ بعد (تُحفظ في settings/appicon عند الضغط على «حفظ»).
  const [pendingIcon, setPendingIcon] = useState<PendingIcon>(null);
  const iconImg = useRef<HTMLImageElement | null>(null);

  // معاينة حيّة للزجاجية على الموقع نفسه أثناء تحريك المربع؛ إن لم تُحفظ تعود القيمة المحفوظة عند مغادرة التبويب.
  const savedGlass = useRef(settings.glass);
  savedGlass.current = settings.glass;
  useEffect(() => {
    applyGlass(form.glass);
  }, [form.glass]);
  useEffect(() => () => applyGlass(savedGlass.current), []);

  const setInstall = <K extends keyof InstallSettings>(k: K, v: InstallSettings[K]) => {
    setDone(false);
    setForm((f) => ({ ...f, install: { ...f.install, [k]: v } }));
  };
  const iconBg = form.install.appIconBg || ICON_BG_DEFAULT;

  function buildIcon(img: HTMLImageElement, bg: string) {
    const png512 = makeIcon(img, 512, bg);
    if (png512.length > 330_000) throw new Error("الصورة معقّدة جدًا؛ جرّب شعارًا أبسط.");
    setPendingIcon({ png192: makeIcon(img, 192, bg), png512 });
  }
  async function onAppIcon(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const img = await loadImage(file);
      iconImg.current = img;
      buildIcon(img, iconBg);
      setDone(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر قراءة الصورة.");
    }
  }
  function onIconBg(v: string) {
    setInstall("appIconBg", v);
    if (iconImg.current) {
      try { buildIcon(iconImg.current, v); } catch { /* تبقى الأيقونة السابقة */ }
    }
  }

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => {
    setDone(false);
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.siteName.trim()) return setError("اسم الموقع مطلوب.");
    if (form.supportLinks.some((l) => (l.label.trim() || l.href.trim()) && (!l.label.trim() || !cleanUrl(l.href)))) {
      return setError("كل رابط دعم يحتاج اسمًا ورابطًا يبدأ بـ https://");
    }
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      return setError("البريد الإلكتروني غير صالح.");
    }
    setSaving(true);
    try {
      let toSave = form;
      if (pendingIcon) {
        await setDoc(doc(getDb(), "settings", "appicon"), { ...pendingIcon, bg: iconBg, updatedAt: serverTimestamp() });
        toSave = { ...form, install: { ...form.install, appIconV: Date.now() } };
      }
      const saved = await saveSettings(toSave);
      update(saved);
      setForm(saved);
      setPendingIcon(null);
      iconImg.current = null;
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <form className="admin-stack" onSubmit={(e) => void onSubmit(e)}>
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

      <section className="panel auth-form" aria-labelledby="st-h-logo">
        <h2 id="st-h-logo">الشعار (يظهر في الهيدر وكأيقونة للتبويب)</h2>
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
        <p className="hint">المعاينة تظهر مباشرة على الموقع نفسه (انظر الترويسة فوق)، ولا تُحفظ حتى تضغط «حفظ الإعدادات».</p>
      </section>

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
      <div className="field">
        <span>أيقونة التطبيق عند تثبيته (على الهاتف والكمبيوتر)</span>
        <div className="addrow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="appicon-prev" src={pendingIcon?.png192 || installIconSrc(form.install)} alt="" width={64} height={64} />
          <label className="btn btn--ghost btn--sm filebtn">
            رفع أيقونة
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void onAppIcon(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {(pendingIcon || form.install.appIconV > 0) && (
            <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => { setPendingIcon(null); iconImg.current = null; setInstall("appIconV", 0); }}>استعادة الافتراضية</button>
          )}
        </div>
        <div className="colorrow">
          <label htmlFor="in-bg">لون خلفية الأيقونة وشاشة فتح التطبيق</label>
          <input id="in-bg" type="color" value={iconBg} onChange={(e) => onIconBg(e.target.value)} />
          {form.install.appIconBg && <button type="button" className="btn btn--ghost btn--sm" onClick={() => onIconBg("")}>افتراضي</button>}
        </div>
        <p className="hint">ارفع شعارًا مربعًا (يفضَّل PNG بخلفية شفافة)؛ يوضع داخل مربع بلون الخلفية. لتغيير لون الخلفية لأيقونة محفوظة سابقًا أعد رفع الصورة. تظهر الأيقونة الجديدة بعد الحفظ، وتحتاج إعادة تثبيت التطبيق ليتحدّث على الأجهزة التي ثبّتته.</p>
      </div>
      <div className="field">
        <span>معاينة النافذة</span>
        <div className="install install--preview">
          <InstallCard install={form.install} name={form.tabName || form.siteName} iconSrc={pendingIcon?.png192} canPrompt onClose={() => {}} />
        </div>
      </div>

      </section>

      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ الإعدادات ✓</p>}
      <div className="addrow">
        <button type="submit" className="btn" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</button>
      </div>
    </form>
  );
}
