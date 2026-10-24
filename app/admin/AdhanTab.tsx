"use client";
import { useEffect, useMemo, useState } from "react";
import AdhanCard from "@/components/AdhanCard";
import {
  ASR_MODES, CITIES, METHODS, PRAYERS, cleanAdhan, configuredCoords,
  type AdhanSettings, type AsrMode, type LocationMode, type MethodId, type PrayerId,
} from "@/lib/adhanCore";
import { timesForDay } from "@/lib/prayer";
import { saveSettings, useSettings } from "@/lib/settings";

const LOCATION_MODES: { id: LocationMode; label: string }[] = [
  { id: "city", label: "مدينة من القائمة" },
  { id: "custom", label: "إحداثيات أكتبها بنفسي" },
  { id: "auto", label: "تلقائي حسب موقع كل زائر (الافتراضي)" },
];

function clock(d: Date): string {
  return new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

/** تبويب «الأذان»: كل ما يخصّ نافذة الأذان، في مربعات منفصلة. */
export default function AdhanTab() {
  const { settings, update, ready } = useSettings();
  const [form, setForm] = useState<AdhanSettings>(settings.adhan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [test, setTest] = useState<number | null>(null); // ثوانٍ متبقية في التجربة

  const set = <K extends keyof AdhanSettings>(k: K, v: AdhanSettings[K]) => {
    setDone(false);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const setPrayer = (id: PrayerId, on: boolean) => set("prayers", { ...form.prayers, [id]: on });
  const setAdjust = (id: PrayerId, n: number) => set("adjust", { ...form.adjust, [id]: n });

  useEffect(() => {
    if (test === null) return;
    if (test <= 0) { setTest(null); return; }
    const t = setTimeout(() => setTest((x) => (x === null ? null : x - 1)), 1000);
    return () => clearTimeout(t);
  }, [test]);

  const coords = configuredCoords(form);
  const todayTimes = useMemo(() => {
    const local = new Date(Date.now() + (coords.lng / 15) * 3600000);
    return timesForDay(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), coords.lat, coords.lng, form);
  }, [form, coords.lat, coords.lng]);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const saved = await saveSettings({ ...settings, adhan: cleanAdhan(form) });
      update(saved);
      setForm(saved.adhan);
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <div className="admin-stack">
      <section className="panel auth-form" aria-labelledby="ad-h-main">
        <h2 id="ad-h-main">تفعيل نافذة الأذان</h2>
        <label className="check"><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> إظهار نافذة الأذان للزوار في أوقات الصلوات</label>
        <label className="check"><input type="checkbox" checked={form.closable} onChange={(e) => set("closable", e.target.checked)} /> السماح للزائر بإغلاق النافذة</label>
        <p className="hint">النافذة تظهر فقط لمن يكون الموقع أو التطبيق مفتوحًا لديه وقت الأذان.</p>
      </section>

      <section className="panel auth-form" aria-labelledby="ad-h-loc">
        <h2 id="ad-h-loc">الموقع</h2>
        <div className="field">
          <label htmlFor="ad-mode">تحديد الموقع</label>
          <select id="ad-mode" value={form.locationMode} onChange={(e) => set("locationMode", e.target.value as LocationMode)}>
            {LOCATION_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        {form.locationMode !== "custom" && (
          <div className="field">
            <label htmlFor="ad-city">{form.locationMode === "auto" ? "المدينة في الأحوال النادرة التي يتعذّر فيها تحديد منطقة الزائر" : "المدينة"}</label>
            <select id="ad-city" value={form.cityId} onChange={(e) => set("cityId", e.target.value)}>
              {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {form.locationMode === "custom" && (
          <div className="two">
            <div className="field">
              <label htmlFor="ad-lat">خط العرض (شمال +)</label>
              <input id="ad-lat" type="number" step="0.0001" min={-66} max={66} dir="ltr" value={form.lat} onChange={(e) => set("lat", Number(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="ad-lng">خط الطول (شرق +)</label>
              <input id="ad-lng" type="number" step="0.0001" min={-180} max={180} dir="ltr" value={form.lng} onChange={(e) => set("lng", Number(e.target.value))} />
            </div>
          </div>
        )}
      </section>

      <section className="panel auth-form" aria-labelledby="ad-h-calc">
        <h2 id="ad-h-calc">طريقة حساب الوقت</h2>
        <div className="field">
          <label htmlFor="ad-method">جهة الحساب (زاويتا الفجر والعشاء)</label>
          <select id="ad-method" value={form.method} onChange={(e) => set("method", e.target.value as MethodId)}>
            {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ad-asr">حساب العصر</label>
          <select id="ad-asr" value={form.asr} onChange={(e) => set("asr", e.target.value as AsrMode)}>
            {ASR_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </section>

      <section className="panel auth-form" aria-labelledby="ad-h-pr">
        <h2 id="ad-h-pr">الصلوات والتعديل بالدقائق</h2>
        {PRAYERS.map((p) => (
          <div className="addrow" key={p.id}>
            <label className="check"><input type="checkbox" checked={form.prayers[p.id]} onChange={(e) => setPrayer(p.id, e.target.checked)} /> {p.label}</label>
            <span dir="ltr"><strong>{clock(todayTimes[p.id])}</strong></span>
            <label>
              <span className="sr-only">تعديل {p.label} بالدقائق</span>
              <input type="number" min={-30} max={30} step={1} dir="ltr" value={form.adjust[p.id]} onChange={(e) => setAdjust(p.id, Number(e.target.value))} style={{ width: 80 }} />
            </label>
            <small>دقيقة</small>
          </div>
        ))}
        <p className="hint">الأوقات المعروضة محسوبة لليوم بحسب الموقع والطريقة أعلاه. الرقم الموجب يؤخّر الصلاة والسالب يقدّمها. قارنها بتقويم مسجدك المحلي قبل الاعتماد عليها.</p>
      </section>

      <section className="panel auth-form" aria-labelledby="ad-h-win">
        <h2 id="ad-h-win">النافذة والنص والعدّاد</h2>
        <div className="field">
          <label htmlFor="ad-text">النص (بين الصورة والعدّاد) — اكتب {"{prayer}"} ليُستبدل باسم الصلاة</label>
          <input id="ad-text" value={form.text} onChange={(e) => set("text", e.target.value)} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="ad-count">مدة العدّ التنازلي: {form.countdownMin} دقيقة</label>
          <input id="ad-count" type="range" min={1} max={60} value={form.countdownMin} onChange={(e) => set("countdownMin", Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="ad-img">رابط صورة المسجد (فارغ = المسجد الكرتوني الافتراضي /images/mosque.svg)</label>
          <input id="ad-img" dir="ltr" placeholder="https://… أو /images/mosque.png" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} maxLength={400} />
        </div>
      </section>

      <section className="panel auth-form" aria-labelledby="ad-h-snd">
        <h2 id="ad-h-snd">صوت التكبيرات</h2>
        <div className="field">
          <label htmlFor="ad-audio">رابط ملف الصوت (mp3) أو مساره داخل الموقع</label>
          <input id="ad-audio" dir="ltr" placeholder="/audio/takbeer.mp3" value={form.audioUrl} onChange={(e) => set("audioUrl", e.target.value)} maxLength={400} />
          <p className="hint">ضع ملف التكبيرات الذي تملك حق استخدامه في المجلد <code dir="ltr">public/audio/</code> ثم اكتب مساره هنا. فارغ = نافذة بلا صوت. المتصفحات تمنع التشغيل التلقائي قبل أن يتفاعل الزائر مع الموقع، فيظهر له زر «اضغط لتشغيل التكبيرات».</p>
        </div>
        <div className="field">
          <label htmlFor="ad-vol">مستوى الصوت: {form.volume}%</label>
          <input id="ad-vol" type="range" min={0} max={100} value={form.volume} onChange={(e) => set("volume", Number(e.target.value))} />
        </div>
      </section>

      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ إعدادات الأذان ✓</p>}
      <div className="addrow">
        <button type="button" className="btn" onClick={() => void save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ إعدادات الأذان"}</button>
        <button type="button" className="btn btn--ghost" onClick={() => setTest(form.countdownMin * 60)}>تجربة النافذة</button>
      </div>

      {test !== null && (
        <div className="adhan-overlay">
          <AdhanCard cfg={{ ...form, closable: true }} prayerLabel="الظهر" remainingSec={test} playAudio onClose={() => setTest(null)} />
        </div>
      )}
    </div>
  );
}
