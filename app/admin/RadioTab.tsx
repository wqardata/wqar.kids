"use client";
import { useMemo, useState } from "react";
import { RADIO_MAX, RADIO_RAW_MAX, RADIO_TITLE_MAX, cleanRadio, newNasheedId, type Nasheed, type RadioSettings } from "@/lib/radioCore";
import { parseDriveId } from "@/lib/drive";
import { DEFAULT_SETTINGS, useSettings } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection } from "./sectionKit";
import { useSettingsOwner } from "./saveKit";

/** تبويب «إعدادات الإذاعة»: أناشيد صفحة /radio، كل نشيد عنوان ورابط ملف صوتي من درايف. */
export default function RadioTab() {
  const { settings, ready } = useSettings();
  const [form, setForm] = useState<RadioSettings>(settings.radio);
  const items = form.items;
  const setItems = (next: Nasheed[]) => setForm({ items: next });
  const patch = (id: string, p: Partial<Nasheed>) => setItems(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const a = [...items];
    [a[i], a[j]] = [a[j], a[i]];
    setItems(a);
  };
  const remove = (id: string) => setItems(items.filter((x) => x.id !== id));
  const add = () => items.length < RADIO_MAX && setItems([...items, { id: newNasheedId(), title: "", drive: "" }]);

  usePreviewDraft("radio", { radio: cleanRadio(form) });
  const draftPatch = useMemo(() => ({ radio: cleanRadio(form) }), [form]);
  useSettingsOwner({
    patch: draftPatch,
    // رابط كُتب ولم يُفهم: نخبر المشرف بدل أن يُهمل بصمت عند الحفظ.
    validate: () => {
      const i = items.findIndex((x) => x.drive.trim() && !parseDriveId(x.drive));
      return i >= 0 ? `رابط النشيد رقم ${i + 1} ليس رابط درايف صالحًا.` : "";
    },
    afterSave: (saved) => setForm(saved.radio),
    reset: () => setForm(DEFAULT_SETTINGS.radio),
  });

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <MovableSection id="radio.list">
      <section className="panel panel--wide auth-form" aria-labelledby="rd-h">
        <h2 id="rd-h">أناشيد الإذاعة ({new Intl.NumberFormat("ar-EG").format(items.length)})</h2>
        <p className="hint">
          الصق رابط ملف صوتي من درايف (يجب أن يكون مشاركًا «أي شخص لديه الرابط – مشاهد»). يظهر الأول في مشغّل صفحة الإذاعة، وتظهر الأناشيد تحته بالترتيب نفسه. الأناشيد التي بلا رابط صالح تُهمل عند الحفظ.
        </p>
        {items.length === 0 && <p className="hint">لا أناشيد بعد. اضغط «إضافة نشيد».</p>}

        {items.map((it, i) => {
          const bad = Boolean(it.drive.trim()) && !parseDriveId(it.drive);
          return (
            <div className="adhkar-ed" key={it.id}>
              <div className="addrow">
                <span className="adhkar-ed-n">{new Intl.NumberFormat("ar-EG").format(i + 1)}</span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`رفع النشيد ${i + 1}`}>▲</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`خفض النشيد ${i + 1}`}>▼</button>
                <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => remove(it.id)} aria-label={`حذف النشيد ${i + 1}`}>حذف</button>
              </div>
              <label className="sr-only" htmlFor={`rd-t-${it.id}`}>عنوان النشيد {i + 1}</label>
              <input id={`rd-t-${it.id}`} value={it.title} maxLength={RADIO_TITLE_MAX} placeholder="عنوان النشيد" onChange={(e) => patch(it.id, { title: e.target.value })} />
              <label className="sr-only" htmlFor={`rd-d-${it.id}`}>رابط درايف للنشيد {i + 1}</label>
              <input
                id={`rd-d-${it.id}`}
                dir="ltr"
                value={it.drive}
                maxLength={RADIO_RAW_MAX}
                placeholder="https://drive.google.com/file/d/…/view"
                aria-invalid={bad}
                onChange={(e) => patch(it.id, { drive: e.target.value })}
              />
              {bad && <p className="field-error" role="alert">لم أفهم هذا الرابط: انسخ رابط الملف من درايف (مشاركة ← نسخ الرابط).</p>}
            </div>
          );
        })}

        <div className="addrow">
          <button type="button" className="btn btn--ghost btn--sm" onClick={add} disabled={items.length >= RADIO_MAX}>＋ إضافة نشيد</button>
        </div>
      </section>
    </MovableSection>
  );
}
