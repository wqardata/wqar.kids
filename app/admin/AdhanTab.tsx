"use client";
import { useEffect, useMemo, useState } from "react";
import AdhanCard from "@/components/AdhanCard";
import AdhanRemind from "@/components/AdhanRemind";
import { METHODS, PRAYERS, autoCalc, cleanAdhan, type AdhanSettings, type PrayerId } from "@/lib/adhanCore";
import { useAutoLocation } from "@/lib/adhanLocation";
import { timesForDay } from "@/lib/prayer";
import { saveSettings, useSettings } from "@/lib/settings";

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
  const setRemind = (id: PrayerId, n: number) => set("remindMin", { ...form.remindMin, [id]: Math.min(60, Math.max(0, Math.round(n) || 0)) });
  const [remindTest, setRemindTest] = useState(false);

  useEffect(() => {
    if (test === null) return;
    if (test <= 0) { setTest(null); return; }
    const t = setTimeout(() => setTest((x) => (x === null ? null : x - 1)), 1000);
    return () => clearTimeout(t);
  }, [test]);

  // معاينة مواقيت اليوم بموقعك أنت (المحفوظ في متصفحك أو التقدير من منطقتك الزمنية)؛ لا تسأل المتصفح عن إذن جديد.
  const { coords } = useAutoLocation(true, false);
  const calc = autoCalc(coords.lat, coords.lng);
  const methodLabel = METHODS.find((m) => m.id === calc.method)?.label ?? "";
  const todayTimes = useMemo(() => {
    const local = new Date(Date.now() + (coords.lng / 15) * 3600000);
    return timesForDay(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), coords.lat, coords.lng);
  }, [coords.lat, coords.lng]);

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
        <h2 id="ad-h-loc">الموقع وطريقة الحساب (تلقائيان)</h2>
        <p className="hint">
          يُحدَّد موقع كل زائر تلقائيًا من جهازه (بعد موافقته في المتصفح)، وإن لم يوافق فيُقدَّر من منطقته الزمنية. وتُختار جهة الحساب ومذهب العصر
          تلقائيًا بحسب منطقته (مثل: الهيئة المصرية في مصر والشام والسودان، وأم القرى في الجزيرة العربية، ورابطة العالم الإسلامي في أوروبا وغيرها).
          لا يوجد إعداد يدوي لهما، ولا يستطيع الزائر تغييرهما.
        </p>
        <p className="hint">لموقعك أنت الآن: الجهة المختارة «{methodLabel}»، وحساب العصر «{calc.asr === "hanafi" ? "الحنفي" : "الجمهور"}».</p>
      </section>

      <section className="panel auth-form" aria-labelledby="ad-h-pr">
        <h2 id="ad-h-pr">الصلوات</h2>
        {PRAYERS.map((p) => (
          <div className="addrow" key={p.id}>
            <label className="check"><input type="checkbox" checked={form.prayers[p.id]} onChange={(e) => setPrayer(p.id, e.target.checked)} /> {p.label}</label>
            <span dir="ltr"><strong>{clock(todayTimes[p.id])}</strong></span>
          </div>
        ))}
        <p className="hint">الأوقات المعروضة هنا معاينة لليوم بموقعك أنت، وكل زائر يرى أوقات موقعه. تُحسب تلقائيًا ولا تُعدَّل يدويًا. قارنها بتقويم مسجدك المحلي قبل الاعتماد عليها.</p>
      </section>

      <section className="panel auth-form" aria-labelledby="ad-h-rem">
        <h2 id="ad-h-rem">التنبيه قبل الأذان</h2>
        <label className="check"><input type="checkbox" checked={form.remind} onChange={(e) => set("remind", e.target.checked)} /> إظهار فقاعة زجاجية «اقتربت صلاة …» قبل موعد كل صلاة</label>
        <div className="field">
          <label htmlFor="ad-rtext">نص التنبيه — {"{prayer}"} اسم الصلاة و{"{min}"} الدقائق المتبقية</label>
          <input id="ad-rtext" value={form.remindText} onChange={(e) => set("remindText", e.target.value)} maxLength={120} />
        </div>
        {PRAYERS.map((p) => (
          <div className="addrow" key={p.id}>
            <span style={{ minWidth: 60 }}>{p.label}</span>
            <label>
              <span className="sr-only">دقائق التنبيه قبل {p.label}</span>
              <input type="number" min={0} max={60} step={1} dir="ltr" value={form.remindMin[p.id]} onChange={(e) => setRemind(p.id, Number(e.target.value))} style={{ width: 80 }} disabled={!form.remind} />
            </label>
            <small>دقيقة قبل الأذان (0 = بلا تنبيه)</small>
          </div>
        ))}
        <p className="hint">تظهر الفقاعة قبل موعد الصلاة بالمدة المضبوطة لها ، ثم تتحول إلى نافذة الأذان عند دخول الوقت. يمكن للزائر إغلاقها. تُحتسب فقط للصلوات المفعّلة في قسم «الصلوات».</p>
        <div className="addrow">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRemindTest(true)} disabled={!form.remind}>تجربة التنبيه</button>
        </div>
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

      {remindTest && (
        <AdhanRemind text={form.remindText} prayerLabel="الظهر" minutes={form.remindMin.dhuhr || 5} onClose={() => setRemindTest(false)} />
      )}

      {test !== null && (
        <div className="adhan-overlay">
          <AdhanCard cfg={{ ...form, closable: true }} prayerLabel="الظهر" remainingSec={test} playAudio onClose={() => setTest(null)} />
        </div>
      )}
    </div>
  );
}
