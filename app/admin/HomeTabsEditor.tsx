"use client";
import { useMemo, useState } from "react";
import { HOME_TABS_MAX, HOME_TAB_DEFAULT_LABEL, type HomeTab } from "@/lib/settings";
import { useNamedList } from "@/lib/videos";

/**
 * محرّر التبويبات أعلى الصفحة الرئيسية: تلقائي (الكل والجديد وكل التصنيفات)، أو يدوي بإضافة وحذف وترتيب وإعادة تسمية.
 * التبويب الأول في القائمة هو المفتوح افتراضيًا عند دخول الزائر.
 */
export default function HomeTabsEditor({ custom, tabs, onChange }: { custom: boolean; tabs: HomeTab[]; onChange: (custom: boolean, tabs: HomeTab[]) => void }) {
  const cats = useNamedList("categories");
  const [pick, setPick] = useState("");
  const catName = useMemo(() => new Map(cats.items.map((c) => [c.id, c.name] as const)), [cats.items]);

  const defaultLabel = (t: HomeTab) => (t.id.startsWith("cat:") ? catName.get(t.id.slice(4)) || t.name || "تصنيف محذوف" : HOME_TAB_DEFAULT_LABEL[t.id] ?? t.id);
  const used = new Set(tabs.map((t) => t.id));
  const available: { id: string; label: string }[] = [
    ...(["all", "new"] as const).filter((id) => !used.has(id)).map((id) => ({ id: id as string, label: `${HOME_TAB_DEFAULT_LABEL[id]} (ثابت)` })),
    ...cats.items.filter((c) => !used.has(`cat:${c.id}`)).map((c) => ({ id: `cat:${c.id}`, label: c.name })),
  ];

  function toggleCustom(on: boolean) {
    if (on && tabs.length === 0) {
      // نبدأ من الوضع التلقائي الحالي ثم يعدّله المشرف.
      const seed: HomeTab[] = [
        { id: "all", label: "", name: "" },
        { id: "new", label: "", name: "" },
        ...cats.items.map((c) => ({ id: `cat:${c.id}`, label: "", name: c.name })),
      ];
      return onChange(true, seed.slice(0, HOME_TABS_MAX));
    }
    onChange(on, tabs);
  }
  const set = (next: HomeTab[]) => onChange(true, next);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= tabs.length) return;
    const next = [...tabs];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const add = () => {
    const a = available.find((x) => x.id === (pick || available[0]?.id));
    if (!a || tabs.length >= HOME_TABS_MAX) return;
    set([...tabs, { id: a.id, label: "", name: a.id.startsWith("cat:") ? catName.get(a.id.slice(4)) ?? "" : "" }]);
    setPick("");
  };

  return (
    <div className="tabs-editor">
      <label className="check">
        <input type="checkbox" checked={custom} onChange={(e) => toggleCustom(e.target.checked)} /> تخصيص التبويبات يدويًا (إضافة وحذف وترتيب)
      </label>
      {!custom ? (
        <p className="hint">الوضع التلقائي: «الكل» و«الجديد» ثم كل تصنيف له فيديوهات، مرتبةً بعدد فيديوهاته.</p>
      ) : (
        <>
          {tabs.length === 0 ? (
            <p className="hint">لا توجد تبويبات: سيختفي الشريط من أعلى الصفحة الرئيسية. أضف تبويبًا من الأسفل.</p>
          ) : (
            <ol className="te-list" aria-label="تبويبات الرئيسية">
              {tabs.map((t, i) => (
                <li key={t.id} className="te-row">
                  <span className="te-n" aria-hidden="true">{i + 1}</span>
                  <div className="te-main">
                    <label className="sr-only" htmlFor={`te-l-${i}`}>اسم التبويب</label>
                    <input id={`te-l-${i}`} value={t.label} maxLength={40} placeholder={defaultLabel(t)} onChange={(e) => set(tabs.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
                    <small>{t.id.startsWith("cat:") ? "تصنيف" : "تبويب ثابت"}{i === 0 ? " • الافتراضي عند الفتح" : ""}</small>
                  </div>
                  <div className="te-actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`رفع «${t.label || defaultLabel(t)}» لأعلى القائمة`}>↑</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === tabs.length - 1} aria-label={`خفض «${t.label || defaultLabel(t)}»`}>↓</button>
                    <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => set(tabs.filter((_, k) => k !== i))} aria-label={`حذف التبويب «${t.label || defaultLabel(t)}»`}>حذف</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="addrow te-add">
            <label htmlFor="te-add" className="sr-only">تبويب للإضافة</label>
            <select id="te-add" value={pick} onChange={(e) => setPick(e.target.value)} disabled={available.length === 0 || tabs.length >= HOME_TABS_MAX}>
              {available.length === 0 ? <option value="">كل التبويبات المتاحة مضافة</option> : available.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            <button type="button" className="btn btn--sm" onClick={add} disabled={available.length === 0 || tabs.length >= HOME_TABS_MAX}>＋ إضافة</button>
          </div>
          <p className="hint">اتركِ اسم التبويب فارغًا ليأخذ اسمه الأصلي، أو اكتب اسمًا مخصّصًا. ما تحذفه من هنا لا يحذف التصنيف نفسه، ويمكنك إعادته من القائمة. يظهر التصنيف الذي لا فيديوهات له برسالة «لا توجد فيديوهات».{cats.loading ? " (جارٍ تحميل التصنيفات…)" : ""}</p>
        </>
      )}
    </div>
  );
}
