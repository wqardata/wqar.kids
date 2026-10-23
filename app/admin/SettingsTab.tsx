"use client";
import { useState, type FormEvent } from "react";
import { cleanUrl, LOGO_MAX, LOGO_MIN, saveSettings, useSettings, type SiteSettings } from "@/lib/settings";

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

export default function SettingsTab() {
  const { settings, update, ready } = useSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

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
    if (form.liveUrl.trim() && !cleanUrl(form.liveUrl)) return setError("رابط البث يجب أن يبدأ بـ https://");
    if (form.supportLinks.some((l) => (l.label.trim() || l.href.trim()) && (!l.label.trim() || !cleanUrl(l.href)))) {
      return setError("كل رابط دعم يحتاج اسمًا ورابطًا يبدأ بـ https://");
    }
    if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      return setError("البريد الإلكتروني غير صالح.");
    }
    setSaving(true);
    try {
      const saved = await saveSettings(form);
      update(saved);
      setForm(saved);
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <form className="auth-form panel" onSubmit={(e) => void onSubmit(e)}>
      <h2>معلومات الموقع الأساسية</h2>
      <div className="field">
        <label htmlFor="st-name">اسم الموقع</label>
        <input id="st-name" value={form.siteName} onChange={(e) => set("siteName", e.target.value)} maxLength={60} required />
      </div>
      <div className="field">
        <label htmlFor="st-desc">وصف الموقع</label>
        <input id="st-desc" value={form.siteDescription} onChange={(e) => set("siteDescription", e.target.value)} maxLength={160} />
      </div>

      <h2>الشعار</h2>
      <div className="logo-box">
        <div className="logo-preview" aria-label="معاينة الهيدر">
          {form.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo} alt="" className="brand-logo" style={{ height: form.logoHeight }} />
          )}
          {(!form.logo || form.showName) && <strong className="brand-prev">{form.siteName || "اسم الموقع"}</strong>}
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

      <h2>الصفحات</h2>
      <div className="field">
        <label htmlFor="st-mail">بريد استقبال «تواصل معنا» (فارغ = تعطيل النموذج)</label>
        <input id="st-mail" type="email" dir="ltr" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="st-live">رابط البث المباشر (فارغ = لا يوجد بث)</label>
        <input id="st-live" type="url" dir="ltr" placeholder="https://" value={form.liveUrl} onChange={(e) => set("liveUrl", e.target.value)} maxLength={300} />
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

      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ الإعدادات ✓</p>}
      <button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</button>
    </form>
  );
}
