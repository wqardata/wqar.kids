"use client";
import { useState, type FormEvent } from "react";
import {
  DEFAULT_DISPLAY,
  DISPLAY_COUNT_MAX,
  DISPLAY_ROWS_MAX,
  GROUP_ORDERS,
  HOME_ORDERS,
  SHORTS_POS_END,
  SHORTS_POS_MAX_ROW,
  cleanDisplay,
  saveSettings,
  useSettings,
  type DisplaySettings,
  type GroupOrder,
  type HomeOrder,
} from "@/lib/settings";

const ROW = 4; // عدد الفيديوهات في الصف على الحاسوب (نفس ثابت الرئيسية)

/** خيارات موضع صف المقاطع القصيرة. */
const SHORTS_POSITIONS: { value: number; label: string }[] = [
  { value: 0, label: "أعلى الصفحة (قبل الفيديوهات)" },
  ...Array.from({ length: SHORTS_POS_MAX_ROW }, (_, i) => ({ value: i + 1, label: `بعد الصف ${i + 1}` })),
  { value: SHORTS_POS_END, label: "في نهاية الصفحة" },
];

/** تبويب «العرض»: إعدادات الرئيسية في مربع، وإعدادات المجموعات في مربع آخر. */
export default function DisplayTab() {
  const { settings, update, ready } = useSettings();
  const [form, setForm] = useState<DisplaySettings>(settings.display);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = <K extends keyof DisplaySettings>(k: K, v: DisplaySettings[K]) => {
    setDone(false);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const num = (k: "homeRows" | "newCount" | "popularCount", raw: string, max: number) => {
    const n = Math.round(Number(raw));
    set(k, Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const saved = await saveSettings({ ...settings, display: cleanDisplay(form) });
      update(saved);
      setForm(saved.display);
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  const topRows = Math.ceil((form.newCount + form.popularCount) / ROW);

  return (
    <form className="admin-stack" onSubmit={(e) => void onSubmit(e)}>
      <section className="panel auth-form" aria-labelledby="dp-h-home">
        <h2 id="dp-h-home">العرض في الصفحة الرئيسية</h2>

        <div className="field">
          <label htmlFor="dp-rows">عدد الصفوف في الرئيسية</label>
          <input id="dp-rows" type="number" inputMode="numeric" dir="ltr" min={0} max={DISPLAY_ROWS_MAX} step={1} value={form.homeRows} onChange={(e) => num("homeRows", e.target.value, DISPLAY_ROWS_MAX)} />
          <p className="hint">الصف الواحد = {ROW} فيديوهات على الحاسوب. اكتب 0 لعرض كل الفيديوهات مع التحميل التدريجي عند النزول.</p>
        </div>

        <div className="two">
          <div className="field">
            <label htmlFor="dp-new">عدد الفيديوهات الجديدة</label>
            <input id="dp-new" type="number" inputMode="numeric" dir="ltr" min={0} max={DISPLAY_COUNT_MAX} step={1} value={form.newCount} onChange={(e) => num("newCount", e.target.value, DISPLAY_COUNT_MAX)} />
          </div>
          <div className="field">
            <label htmlFor="dp-pop">عدد الأكثر مشاهدة</label>
            <input id="dp-pop" type="number" inputMode="numeric" dir="ltr" min={0} max={DISPLAY_COUNT_MAX} step={1} value={form.popularCount} onChange={(e) => num("popularCount", e.target.value, DISPLAY_COUNT_MAX)} />
          </div>
        </div>
        <p className="hint">
          هذان العددان يكوّنان المجموعة الأولى من الصفوف ({topRows === 0 ? "لا صفوف" : `${topRows} ${topRows === 1 ? "صف" : topRows === 2 ? "صفان" : "صفوف"}`})؛ تُكمَل خانات آخر صف فيها بفيديوهات أخرى، وتبدأ بعدها المجموعة الثانية ببقية الفيديوهات.
        </p>

        <div className="field">
          <label htmlFor="dp-order">طريقة العرض</label>
          <select id="dp-order" value={form.homeOrder} onChange={(e) => set("homeOrder", e.target.value as HomeOrder)}>
            {HOME_ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="dp-t1">عنوان يسبق المجموعة الأولى من الصفوف</label>
          <input id="dp-t1" value={form.titleTop} onChange={(e) => set("titleTop", e.target.value)} maxLength={60} placeholder="مثال: الجديد والأكثر مشاهدة" />
        </div>
        <div className="field">
          <label htmlFor="dp-t2">عنوان يسبق بقية الصفوف</label>
          <input id="dp-t2" value={form.titleRest} onChange={(e) => set("titleRest", e.target.value)} maxLength={60} placeholder="مثال: المزيد من الفيديوهات" />
          <p className="hint">اتركهما فارغين لعدم إظهار أي عنوان.</p>
        </div>

        <label className="check">
          <input type="checkbox" checked={form.shortsShow} onChange={(e) => set("shortsShow", e.target.checked)} /> إظهار صف المقاطع القصيرة في الرئيسية
        </label>
        {form.shortsShow && (
          <div className="field">
            <label htmlFor="dp-shorts">مكان صف المقاطع القصيرة</label>
            <select id="dp-shorts" value={form.shortsPos} onChange={(e) => set("shortsPos", Number(e.target.value))}>
              {SHORTS_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <p className="hint">إن كان عدد الفيديوهات أقل من الصف المحدّد يظهر الصف في النهاية.</p>
          </div>
        )}
      </section>

      <section className="panel auth-form" aria-labelledby="dp-h-group">
        <h2 id="dp-h-group">العرض في المجموعات</h2>
        <div className="field">
          <label htmlFor="dp-group">ترتيب الفيديوهات داخل المجموعة</label>
          <select id="dp-group" value={form.groupOrder} onChange={(e) => set("groupOrder", e.target.value as GroupOrder)}>
            {GROUP_ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <p className="hint">يُطبَّق على صفحة كل مجموعة (/series).</p>
        </div>
      </section>

      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ إعدادات العرض ✓</p>}
      <div className="addrow">
        <button type="submit" className="btn" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ إعدادات العرض"}</button>
        <button type="button" className="btn btn--ghost" disabled={saving} onClick={() => { setForm(DEFAULT_DISPLAY); setDone(false); }}>استعادة الافتراضي</button>
      </div>
    </form>
  );
}
