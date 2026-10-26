"use client";
import { HOME_ROW_LIST_MAX, ROW_SIZE_DEFAULT, ROW_SIZE_MAX, ROW_SIZE_MIN } from "@/lib/settings";

type Patch = { homeRowsCustom?: boolean; homeRowSizes?: number[]; homeRowsMore?: boolean };

const clamp = (n: number) => Math.min(ROW_SIZE_MAX, Math.max(ROW_SIZE_MIN, Math.round(n) || ROW_SIZE_MIN));

/**
 * محرّر صفوف الرئيسية: لكل صف عدد فيديوهاته (الافتراضي 3)، مع إضافة صف وحذفه وترتيبه.
 * مجموع الأعداد = عدد الفيديوهات المعروضة؛ ويمكن إكمال بقية الفيديوهات بعد آخر صف (3 في الصف مع تحميل تدريجي).
 */
export default function HomeRowsEditor({ custom, sizes, more, onChange }: { custom: boolean; sizes: number[]; more: boolean; onChange: (p: Patch) => void }) {
  const total = sizes.reduce((a, b) => a + b, 0);
  const setSizes = (next: number[]) => onChange({ homeRowSizes: next });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= sizes.length) return;
    const next = [...sizes];
    [next[i], next[j]] = [next[j], next[i]];
    setSizes(next);
  };

  return (
    <div className="tabs-editor">
      <label className="check">
        <input type="checkbox" checked={custom} onChange={(e) => onChange({ homeRowsCustom: e.target.checked })} /> تحديد عدد الفيديوهات في كل صف على حدة (الافتراضي {ROW_SIZE_DEFAULT} في الصف)
      </label>
      {custom && (
        <>
          <ol className="te-list" aria-label="صفوف الرئيسية">
            {sizes.map((n, i) => (
              <li key={i} className="te-row">
                <span className="te-n" aria-hidden="true">{i + 1}</span>
                <div className="te-main">
                  <label htmlFor={`hr-n-${i}`}>الصف {i + 1}: عدد الفيديوهات</label>
                  <input id={`hr-n-${i}`} type="number" inputMode="numeric" dir="ltr" min={ROW_SIZE_MIN} max={ROW_SIZE_MAX} step={1} value={n} onChange={(e) => setSizes(sizes.map((x, k) => (k === i ? clamp(Number(e.target.value)) : x)))} />
                </div>
                <div className="te-actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`رفع الصف ${i + 1} لأعلى`}>↑</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === sizes.length - 1} aria-label={`خفض الصف ${i + 1}`}>↓</button>
                  <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => setSizes(sizes.filter((_, k) => k !== i))} disabled={sizes.length <= 1} aria-label={`حذف الصف ${i + 1}`}>حذف</button>
                </div>
              </li>
            ))}
          </ol>
          <div className="addrow">
            <button type="button" className="btn btn--sm" onClick={() => setSizes([...sizes, ROW_SIZE_DEFAULT])} disabled={sizes.length >= HOME_ROW_LIST_MAX}>＋ إضافة صف ({ROW_SIZE_DEFAULT} فيديوهات)</button>
          </div>
          <p className="hint" role="status">
            المجموع: {sizes.length} {sizes.length === 1 ? "صف" : sizes.length === 2 ? "صفان" : "صفوف"} • {total} فيديو. الحد الأقصى {ROW_SIZE_MAX} فيديوهات في الصف و{HOME_ROW_LIST_MAX} صفًّا.
          </p>
          <label className="check">
            <input type="checkbox" checked={more} onChange={(e) => onChange({ homeRowsMore: e.target.checked })} /> متابعة عرض بقية الفيديوهات بعد آخر صف ({ROW_SIZE_DEFAULT} في الصف مع تحميل تدريجي عند النزول)
          </label>
          <p className="hint">
            {more ? "عند إلغاء الخيار تتوقف الصفحة عند آخر صف أعلاه، فيكون عدد الفيديوهات المعروضة هو المجموع فقط." : `الصفحة تتوقف الآن عند آخر صف: يظهر ${total} فيديو فقط.`} على الجوال يظهر فيديو واحد في كل سطر، وعلى الشاشات المتوسطة يتكيّف العدد مع العرض؛ عدد الأعمدة المحدّد يُطبَّق على الحاسوب. اختيار «بعد الصف n» في المقاطع القصيرة يحسب الصفوف حسب هذه القائمة.
          </p>
        </>
      )}
    </div>
  );
}
