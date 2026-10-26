"use client";
import { useState, type FormEvent } from "react";
import {
  DEFAULT_WATCH_PAGE,
  SUG_COUNT_MAX,
  SUG_LAYOUTS,
  SUG_ORDERS,
  SUG_SCOPES,
  cleanWatchPage,
  saveSettings,
  useSettings,
  type SugLayout,
  type SugOrder,
  type SugScope,
  type WatchPageSettings,
} from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerFooter, OwnerForm } from "./sectionKit";

type FlagKey = { [K in keyof WatchPageSettings]: WatchPageSettings[K] extends boolean ? K : never }[keyof WatchPageSettings];

/** الفيديوهات المقترحة في صفحة الفيديو: العدد وطريقة العرض والصلة بالفيديو المشغَّل ومعايير الاختيار. */
export default function SuggestedSettings() {
  const { settings, update, ready } = useSettings();
  const [form, setForm] = useState<WatchPageSettings>(settings.watchPage);
  usePreviewDraft("watch-page", { watchPage: cleanWatchPage(form) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = <K extends keyof WatchPageSettings>(k: K, v: WatchPageSettings[K]) => {
    setDone(false);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const int = (raw: string, lo: number, hi: number) => {
    const n = Math.round(Number(raw));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
  };
  const flag = (k: FlagKey, label: string, hint?: string) => (
    <div>
      <label className="check">
        <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const saved = await saveSettings({ ...settings, watchPage: cleanWatchPage(form) });
      update(saved);
      setForm(saved.watchPage);
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;

  const mix = form.sugOrder === "mix";

  return (
    <OwnerForm onSubmit={(e) => void onSubmit(e)}>
    <MovableSection id="watch.suggested">
    <div className="panel menu-admin auth-form dbox" aria-labelledby="sg-h">
      <h2 id="sg-h">الفيديوهات المقترحة</h2>
      <p className="hint">تظهر تحت الفيديو على الجوال، وبجانبه على الشاشات الكبيرة.</p>

      {flag("sugShow", "إظهار قسم الفيديوهات المقترحة")}

      {form.sugShow && (
        <>
          <section className="dsec" aria-labelledby="sg-s-basic">
            <h3 id="sg-s-basic" className="dsec-h">العدد وطريقة العرض</h3>
            <div className="two">
              <div className="field">
                <label htmlFor="sg-count">عدد الفيديوهات</label>
                <input id="sg-count" type="number" inputMode="numeric" dir="ltr" min={1} max={SUG_COUNT_MAX} step={1} value={form.sugCount} onChange={(e) => set("sugCount", int(e.target.value, 1, SUG_COUNT_MAX))} />
              </div>
              <div className="field">
                <label htmlFor="sg-layout">طريقة العرض</label>
                <select id="sg-layout" value={form.sugLayout} onChange={(e) => set("sugLayout", e.target.value as SugLayout)}>
                  {SUG_LAYOUTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="sg-title">عنوان القسم</label>
              <input id="sg-title" value={form.sugTitle} onChange={(e) => set("sugTitle", e.target.value)} maxLength={60} placeholder="فيديوهات مقترحة" />
              <p className="hint">اتركه فارغًا لإخفاء العنوان.</p>
            </div>
            <p className="hint">يُختار المقترح من أحدث {80} فيديو في الموقع.</p>
          </section>

          <section className="dsec" aria-labelledby="sg-s-rel">
            <h3 id="sg-s-rel" className="dsec-h">الصلة بالفيديو المشغَّل</h3>
            <div className="field">
              <label htmlFor="sg-scope">مصدر المقترحات</label>
              <select id="sg-scope" value={form.sugScope} onChange={(e) => set("sugScope", e.target.value as SugScope)}>
                {SUG_SCOPES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <p className="hint">إن لم يوجد شيء في المجموعة أو التصنيف المحدّد تُكمَل القائمة ببقية الفيديوهات.</p>
            </div>
            {flag("sugPrioSeries", "تقديم فيديوهات نفس المجموعة")}
            {flag("sugPrioCategory", "تقديم فيديوهات نفس التصنيف")}
            {flag("sugNextFirst", "الحلقة التالية من نفس المجموعة أولًا", "تُحدَّد بالموسم ثم رقم الحلقة المسجّلين في تعديل الفيديو.")}
          </section>

          <section className="dsec" aria-labelledby="sg-s-crit">
            <h3 id="sg-s-crit" className="dsec-h">معايير الاختيار والترتيب</h3>
            <div className="field">
              <label htmlFor="sg-order">الترتيب</label>
              <select id="sg-order" value={form.sugOrder} onChange={(e) => set("sugOrder", e.target.value as SugOrder)}>
                {SUG_ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            {mix && (
              <div className="field">
                <label htmlFor="sg-rel">عدد الأقرب للفيديو الحالي في البداية</label>
                <input id="sg-rel" type="number" inputMode="numeric" dir="ltr" min={0} max={form.sugCount} step={1} value={Math.min(form.sugRelated, form.sugCount)} onChange={(e) => set("sugRelated", int(e.target.value, 0, form.sugCount))} />
                <p className="hint">الباقي ({Math.max(0, form.sugCount - form.sugRelated)}) يُختار عشوائيًا من بقية الفيديوهات.</p>
              </div>
            )}
            {flag("sugHideWatched", "إخفاء ما أكمل الزائر مشاهدته", "يعتمد على سجل المشاهدة في متصفح كل زائر.")}
            {flag("sugShorts", "تضمين المقاطع القصيرة")}
          </section>

          <section className="dsec" aria-labelledby="sg-s-show">
            <h3 id="sg-s-show" className="dsec-h">ما يظهر على كل فيديو</h3>
            {flag("sugShowDuration", "مدة الفيديو على الصورة")}
            {flag("sugShowSeries", "اسم المجموعة")}
            {flag("sugShowEpisode", "الموسم والحلقة")}
            {flag("sugShowViews", "المشاهدات ووقت النشر")}
          </section>
        </>
      )}

    </div>
    </MovableSection>
    <OwnerFooter>
      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ إعدادات المقترحات ✓</p>}
      <div className="addrow">
        <button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ إعدادات المقترحات"}</button>
        <button type="button" className="btn btn--ghost" disabled={saving} onClick={() => { setForm(DEFAULT_WATCH_PAGE); setDone(false); }}>استعادة الافتراضي</button>
      </div>
    </OwnerFooter>
    </OwnerForm>
  );
}
