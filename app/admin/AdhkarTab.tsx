"use client";
import { useMemo, useState } from "react";
import AdhkarPrompt from "@/components/AdhkarPrompt";
import AdhkarReader from "@/components/AdhkarReader";
import {
  ADHKAR_KINDS, ITEMS_MAX, OFFSET_MAX, adhkarWindows, type Boundary, NOTE_MAX, REPEAT_MAX, TEXT_MAX, cleanAdhkar, newDhikrId,
  type AdhkarKind, type AdhkarSettings, type Dhikr,
} from "@/lib/adhkarCore";
import { PRAYERS, type PrayerId } from "@/lib/adhanCore";
import { useAutoLocation } from "@/lib/adhanLocation";
import { slotsAround } from "@/lib/prayer";
import { saveSettings, useSettings } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerFooter, OwnerForm } from "./sectionKit";

const preview0 = cleanAdhkar;
const clock = (t: number) => new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(t));

/** محرّر حدّ زمني واحد: صلاة ± دقائق، أو ساعة ثابتة. */
function BoundaryEditor({ id, label, value, onChange }: { id: string; label: string; value: Boundary; onChange: (b: Boundary) => void }) {
  const set = (p: Partial<Boundary>) => onChange({ ...value, ...p });
  const before = value.offsetMin < 0;
  return (
    <fieldset className="adhkar-bd">
      <legend>{label}</legend>
      <div className="addrow">
        <label>
          <span className="sr-only">{label}: طريقة التحديد</span>
          <select id={`${id}-mode`} value={value.mode} onChange={(e) => set({ mode: e.target.value as Boundary["mode"] })}>
            <option value="prayer">بالنسبة لصلاة</option>
            <option value="clock">ساعة ثابتة</option>
          </select>
        </label>
        {value.mode === "clock" ? (
          <label>
            <span className="sr-only">{label}: الساعة</span>
            <input type="time" dir="ltr" value={value.time} onChange={(e) => e.target.value && set({ time: e.target.value })} style={{ width: 130 }} />
          </label>
        ) : (
          <>
            <label>
              <span className="sr-only">{label}: الصلاة</span>
              <select value={value.prayer} onChange={(e) => set({ prayer: e.target.value as PrayerId })}>
                {PRAYERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">{label}: قبل أو بعد</span>
              <select value={before ? "before" : "after"} onChange={(e) => set({ offsetMin: (e.target.value === "before" ? -1 : 1) * Math.abs(value.offsetMin) })}>
                <option value="after">بعد الأذان بـ</option>
                <option value="before">قبل الأذان بـ</option>
              </select>
            </label>
            <label>
              <span className="sr-only">{label}: الدقائق</span>
              <input type="number" min={0} max={OFFSET_MAX} step={1} dir="ltr" style={{ width: 80 }} value={Math.abs(value.offsetMin)}
                onChange={(e) => {
                  const n = Math.min(OFFSET_MAX, Math.max(0, Math.round(Number(e.target.value)) || 0));
                  set({ offsetMin: before ? -n : n });
                }} />
            </label>
            <small>دقيقة (0 = عند الأذان تمامًا)</small>
          </>
        )}
      </div>
    </fieldset>
  );
}

/** تبويب «إعدادات الأذكار»: التفعيل والأوقات، وقوائم أذكار الصباح والمساء التي يضيفها المشرف، ومعاينة حيّة. */
export default function AdhkarTab() {
  const { settings, update, ready } = useSettings();
  const [form, setForm] = useState<AdhkarSettings>(settings.adhkar);
  usePreviewDraft("adhkar", { adhkar: cleanAdhkar(form) });
  const [kind, setKind] = useState<AdhkarKind>("morning");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [reading, setReading] = useState(false);
  const [prevMsg, setPrevMsg] = useState("");

  const set = <K extends keyof AdhkarSettings>(k: K, v: AdhkarSettings[K]) => {
    setDone(false);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const items = form[kind];
  const setItems = (next: Dhikr[]) => set(kind, next);
  const patch = (id: string, p: Partial<Dhikr>) => setItems(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const a = [...items];
    [a[i], a[j]] = [a[j], a[i]];
    setItems(a);
  };
  const remove = (id: string) => setItems(items.filter((x) => x.id !== id));
  const add = () => items.length < ITEMS_MAX && setItems([...items, { id: newDhikrId(), text: "", repeat: 1, note: "" }]);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const saved = await saveSettings({ ...settings, adhkar: cleanAdhkar(form) });
      update(saved);
      setForm(saved.adhkar);
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  // معاينة بموقعك أنت (بلا طلب إذن جديد)؛ كل زائر يرى أذكار موقعه.
  const { coords } = useAutoLocation(true, false);
  const todayText = useMemo(() => {
    const kd = kind;
    const slots = slotsAround(new Date(), coords.lat, coords.lng);
    const now = Date.now();
    const w = adhkarWindows(preview0(form), slots).filter((x) => x.kind === kd);
    // نافذة اليوم الجارية أو القادمة.
    const pick = w.find((x) => x.end > now);
    if (!pick) return "لا توجد نافذة محسوبة (تحقق من التوقيتين أو من تفعيل هذا النوع وإضافة أذكار له).";
    return `بحسب موقعك أنت الآن: من ${clock(pick.start)} إلى ${clock(pick.end)} (يختلف قليلًا من يوم لآخر، وبحسب موقع كل زائر).`;
  }, [form, kind, coords.lat, coords.lng]);

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  const k = ADHKAR_KINDS.find((x) => x.id === kind)!;
  // المعاينة تستعمل ما في النموذج الآن (حتى قبل الحفظ)، مع تجاهل الأذكار الفارغة.
  const preview = cleanAdhkar(form);
  const previewItems = kind === "morning" ? preview.morning : preview.evening;

  return (
    <>
      <MovableSection id="adhkar.main">
      <section className="panel auth-form" aria-labelledby="ak-h-main">
        <h2 id="ak-h-main">تفعيل الأذكار</h2>
        <label className="check"><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> إظهار إشعار الأذكار للزوار</label>
        <label className="check"><input type="checkbox" checked={form.morningEnabled} onChange={(e) => set("morningEnabled", e.target.checked)} disabled={!form.enabled} /> أذكار الصباح</label>
        <label className="check"><input type="checkbox" checked={form.eveningEnabled} onChange={(e) => set("eveningEnabled", e.target.checked)} disabled={!form.enabled} /> أذكار المساء</label>
        <p className="hint">تُحسب أوقات الصلوات بنفس موقع الزائر وطريقة الحساب في «إعدادات الأذان»، وتُحتسب «الساعة الثابتة» بتوقيت جهازه. اضبط وقت كل نوع من قسم «قوائم الأذكار» أدناه. يظهر الإشعار لمن يكون الموقع مفتوحًا لديه خلال هذه الأوقات، ويختفي بعد ضغطه «قلتها» أو إتمام الأذكار.</p>
      </section>
      </MovableSection>

      <MovableSection id="adhkar.list">
      <section className="panel panel--wide auth-form" aria-labelledby="ak-h-list">
        <h2 id="ak-h-list">قوائم الأذكار</h2>
        <div role="tablist" aria-label="نوع الأذكار" className="tabs tabs--sub">
          {ADHKAR_KINDS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={kind === x.id} className={kind === x.id ? "tab on" : "tab"} onClick={() => setKind(x.id)}>
              {x.icon} {x.label} ({new Intl.NumberFormat("ar-EG").format(form[x.id].length)})
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="ak-text">نص الإشعار المنبثق ({k.label})</label>
          <input
            id="ak-text"
            value={kind === "morning" ? form.morningText : form.eveningText}
            onChange={(e) => set(kind === "morning" ? "morningText" : "eveningText", e.target.value)}
            maxLength={120}
          />
        </div>

        <BoundaryEditor id={`ak-${kind}-s`} label={`يظهر إشعار ${k.label}`} value={kind === "morning" ? form.morningStart : form.eveningStart} onChange={(b) => set(kind === "morning" ? "morningStart" : "eveningStart", b)} />
        <BoundaryEditor id={`ak-${kind}-e`} label={`يختفي إشعار ${k.label}`} value={kind === "morning" ? form.morningEnd : form.eveningEnd} onChange={(b) => set(kind === "morning" ? "morningEnd" : "eveningEnd", b)} />
        <p className="hint" role="status">{todayText}</p>

        {items.length === 0 && <p className="hint">لا توجد أذكار في هذه القائمة، ولن يظهر الإشعار حتى تضيف ذكرًا واحدًا على الأقل.</p>}

        {items.map((it, i) => (
          <div className="adhkar-ed" key={it.id}>
            <div className="addrow">
              <span className="adhkar-ed-n">{new Intl.NumberFormat("ar-EG").format(i + 1)}</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`رفع الذكر ${i + 1}`}>▲</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`خفض الذكر ${i + 1}`}>▼</button>
              <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => remove(it.id)} aria-label={`حذف الذكر ${i + 1}`}>حذف</button>
            </div>
            <label className="sr-only" htmlFor={`ak-t-${it.id}`}>نص الذكر {i + 1}</label>
            <textarea id={`ak-t-${it.id}`} value={it.text} maxLength={TEXT_MAX} placeholder="اكتب نص الذكر هنا" onChange={(e) => patch(it.id, { text: e.target.value })} />
            <div className="addrow">
              <label>
                <span className="sr-only">عدد مرات التكرار</span>
                <input type="number" min={1} max={REPEAT_MAX} step={1} dir="ltr" value={it.repeat} onChange={(e) => patch(it.id, { repeat: Math.min(REPEAT_MAX, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} />
              </label>
              <small>مرة (عدد التكرار)</small>
              <label style={{ flex: 1, minWidth: 160 }}>
                <span className="sr-only">الفضل أو المصدر</span>
                <input value={it.note} maxLength={NOTE_MAX} placeholder="الفضل أو المصدر (اختياري)" onChange={(e) => patch(it.id, { note: e.target.value })} style={{ width: "100%" }} />
              </label>
            </div>
          </div>
        ))}

        <div className="addrow">
          <button type="button" className="btn btn--ghost btn--sm" onClick={add} disabled={items.length >= ITEMS_MAX}>＋ إضافة ذكر إلى {k.label}</button>
        </div>
        <p className="hint">الأذكار الفارغة تُهمل عند الحفظ. الترتيب هنا هو ترتيب ظهورها للزائر. الأذكار المبدئية معروفة، لكن راجعها وعدّلها بما تعتمده.</p>
      </section>
      </MovableSection>

      <MovableSection id="adhkar.preview">
      <section className="panel panel--wide auth-form" aria-labelledby="ak-h-prev">
        <h2 id="ak-h-prev">معاينة ({k.label})</h2>
        <div className="adhkar-preview">
          <AdhkarPrompt
            inline
            icon={k.icon}
            text={kind === "morning" ? preview.morningText : preview.eveningText}
            onDone={() => setPrevMsg("معاينة: عند «قلتها» يختفي الإشعار لباقي اليوم.")}
            onNow={() => (previewItems.length ? setReading(true) : setPrevMsg("أضف ذكرًا واحدًا على الأقل لتعمل المعاينة."))}
            onLater={() => setPrevMsg("معاينة: عند ✕ يختفي الإشعار ويعود بعد 30 دقيقة.")}
          />
        </div>
        {prevMsg && <p className="hint" role="status">{prevMsg}</p>}
        <div className="addrow">
          <button type="button" className="btn btn--ghost" onClick={() => setReading(true)} disabled={previewItems.length === 0}>معاينة النافذة الكاملة</button>
        </div>
        <p className="hint">المعاينة تعرض ما كتبته الآن حتى قبل الحفظ. زرّا الإشعار هنا للتجربة فقط، و«سأقولها الآن» يفتح القارئ بملء الشاشة: اسحب لليسار للذكر التالي ولليمين للسابق.</p>
      </section>
      </MovableSection>

      <OwnerFooter>
      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ إعدادات الأذكار ✓</p>}
      <div className="addrow">
        <button type="button" className="btn" onClick={() => void save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ إعدادات الأذكار"}</button>
      </div>

      {reading && previewItems.length > 0 && (
        <AdhkarReader title={k.label} icon={k.icon} items={previewItems} onClose={() => setReading(false)} onFinish={() => setReading(false)} />
      )}
      </OwnerFooter>
    </>
  );
}
