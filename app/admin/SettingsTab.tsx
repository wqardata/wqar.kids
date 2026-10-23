"use client";
import { useState, type FormEvent } from "react";
import { cleanUrl, saveSettings, useSettings, type SiteSettings } from "@/lib/settings";

export default function SettingsTab() {
  const { settings, update } = useSettings();
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
