"use client";
import { useEffect, useMemo, useState } from "react";
import AdhanCard from "@/components/AdhanCard";
import AdhanRemind from "@/components/AdhanRemind";
import { DEFAULT_PARENT_OPTIONS, METHODS, PARENT_LABEL_MAX, PARENT_OPTIONS_MAX, PRAYERS, audioSources, autoCalc, cleanAdhan, type AdhanSettings, type ParentAction, type ParentOption, type PrayerId } from "@/lib/adhanCore";
import { useAutoLocation } from "@/lib/adhanLocation";
import { timesForDay } from "@/lib/prayer";
import { DEFAULT_SETTINGS, useSettings } from "@/lib/settings";
import { playAlert } from "@/lib/sounds";
import SoundSettings from "@/app/admin/SoundSettings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerFooter } from "./sectionKit";
import { useSettingsOwner } from "./saveKit";

function clock(d: Date): string {
  return new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

/** تبويب «الأذان»: كل ما يخصّ نافذة الأذان، في مربعات منفصلة. */
export default function AdhanTab() {
  const { settings, ready } = useSettings();
  const [form, setForm] = useState<AdhanSettings>(settings.adhan);
  usePreviewDraft("adhan", { adhan: cleanAdhan(form) });
  const patch = useMemo(() => ({ adhan: cleanAdhan(form) }), [form]);
  useSettingsOwner({
    patch,
    afterSave: (saved) => setForm(saved.adhan),
    reset: () => setForm(DEFAULT_SETTINGS.adhan),
  });
  const [test, setTest] = useState<number | null>(null); // ثوانٍ متبقية في التجربة

  const set = <K extends keyof AdhanSettings>(k: K, v: AdhanSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };
  const setPrayer = (id: PrayerId, on: boolean) => set("prayers", { ...form.prayers, [id]: on });
  const setRemind = (id: PrayerId, n: number) => set("remindMin", { ...form.remindMin, [id]: Math.min(60, Math.max(0, Math.round(n) || 0)) });
  const [remindTest, setRemindTest] = useState(false);
  const setOptions = (list: ParentOption[]) => set("parentOptions", list);
  const patchOption = (id: string, p: Partial<ParentOption>) => setOptions(form.parentOptions.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const moveOption = (k: number, d: number) => {
    const a = [...form.parentOptions];
    const j = k + d;
    if (j < 0 || j >= a.length) return;
    [a[k], a[j]] = [a[j], a[k]];
    setOptions(a);
  };
  const addOption = () => setOptions([...form.parentOptions, { id: `n${Date.now().toString(36)}`, label: "", action: "continue" }]);

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

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <>
      <MovableSection id="adhan.main">
      <section className="panel auth-form" aria-labelledby="ad-h-main">
        <h2 id="ad-h-main">تفعيل نافذة الأذان</h2>
        <label className="check"><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> إظهار نافذة الأذان للزوار في أوقات الصلوات</label>
        <label className="check"><input type="checkbox" checked={form.closable} onChange={(e) => set("closable", e.target.checked)} /> السماح للزائر بإغلاق النافذة</label>
        <label className="check"><input type="checkbox" checked={form.adminShow} onChange={(e) => set("adminShow", e.target.checked)} /> إظهار نافذة الأذان وتنبيه «اقتربت صلاة» للمشرفين أيضًا</label>
        <p className="hint">النافذة تظهر فقط لمن يكون الموقع أو التطبيق مفتوحًا لديه وقت الأذان. خيار المشرفين معطّل افتراضيًا: لا ترى حسابات المشرفين (ومنهم أنت) النافذة ولا التنبيه، فلا يُقاطَع عملهم في لوحة التحكم، بينما تبقى ظاهرة لبقية الزوار. «تجربة النافذة» و«تجربة التنبيه» تعملان دائمًا.</p>
      </section>
      </MovableSection>

      <MovableSection id="adhan.loc">
      <section className="panel auth-form" aria-labelledby="ad-h-loc">
        <h2 id="ad-h-loc">الموقع وطريقة الحساب (تلقائيان)</h2>
        <p className="hint">
          يُحدَّد موقع كل زائر تلقائيًا من جهازه (بعد موافقته في المتصفح)، وإن لم يوافق فيُقدَّر من منطقته الزمنية. وتُختار جهة الحساب ومذهب العصر
          تلقائيًا بحسب منطقته (مثل: الهيئة المصرية في مصر والشام والسودان، وأم القرى في الجزيرة العربية، ورابطة العالم الإسلامي في أوروبا وغيرها).
          لا يوجد إعداد يدوي لهما، ولا يستطيع الزائر تغييرهما.
        </p>
        <p className="hint">لموقعك أنت الآن: الجهة المختارة «{methodLabel}»، وحساب العصر «{calc.asr === "hanafi" ? "الحنفي" : "الجمهور"}».</p>
      </section>
      </MovableSection>

      <MovableSection id="adhan.prayers">
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
      </MovableSection>

      <MovableSection id="adhan.remind">
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
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setRemindTest(true); playAlert("remind", settings.sounds.volume); }} disabled={!form.remind}>تجربة التنبيه</button>
        </div>
      </section>
      </MovableSection>

      <MovableSection id="adhan.window">
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
      </MovableSection>

      <MovableSection id="adhan.parent">
      <section className="panel auth-form" aria-labelledby="ad-h-par">
        <h2 id="ad-h-par">خيارات «توجيه الوالدين»</h2>
        <p className="hint">تظهر هذه الخيارات حين يضغط الزائر على «توجيه الوالدين» في نافذة الأذان. لكل خيار نص وإجراء: <strong>إغلاق النافذة ومتابعة المشاهدة</strong> أو <strong>الرجوع لنافذة الأذان</strong>. إن حذفتَ كل الخيارات يختفي زر «توجيه الوالدين». الخيارات التي نصها فارغ تُهمل عند الحفظ.</p>
        {form.parentOptions.map((o, k) => (
          <fieldset key={o.id} className="adhkar-bd">
            <legend>الخيار {k + 1}</legend>
            <div className="field">
              <label htmlFor={`ad-po-t-${o.id}`}>نص الخيار</label>
              <input id={`ad-po-t-${o.id}`} value={o.label} maxLength={PARENT_LABEL_MAX} onChange={(e) => patchOption(o.id, { label: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`ad-po-a-${o.id}`}>عند الضغط عليه</label>
              <select id={`ad-po-a-${o.id}`} value={o.action} onChange={(e) => patchOption(o.id, { action: e.target.value as ParentAction })}>
                <option value="continue">إغلاق نافذة الأذان ومتابعة المشاهدة</option>
                <option value="back">الرجوع لنافذة الأذان</option>
              </select>
            </div>
            <div className="addrow">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => moveOption(k, -1)} disabled={k === 0} aria-label="نقل لأعلى">↑</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => moveOption(k, 1)} disabled={k === form.parentOptions.length - 1} aria-label="نقل لأسفل">↓</button>
              <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => setOptions(form.parentOptions.filter((x) => x.id !== o.id))}>حذف</button>
            </div>
          </fieldset>
        ))}
        {form.parentOptions.length === 0 && <p className="hint" role="status">لا توجد خيارات: لن يظهر زر «توجيه الوالدين» للزوار.</p>}
        <div className="addrow">
          <button type="button" className="btn btn--ghost btn--sm" onClick={addOption} disabled={form.parentOptions.length >= PARENT_OPTIONS_MAX}>＋ إضافة خيار</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOptions(DEFAULT_PARENT_OPTIONS.map((x) => ({ ...x })))}>استعادة الافتراضي</button>
          <small>حتى {PARENT_OPTIONS_MAX} خيارات. جرّبها من زر «تجربة النافذة» أسفل الصفحة.</small>
        </div>
      </section>
      </MovableSection>

      <MovableSection id="adhan.takbir">
      <section className="panel auth-form" aria-labelledby="ad-h-snd">
        <h2 id="ad-h-snd">صوت التكبيرات</h2>
        <div className="field">
          <label htmlFor="ad-audio">ملف صوت التكبيرات: رابط مباشر لملف (mp3) أو مساره داخل الموقع</label>
          <input id="ad-audio" dir="ltr" placeholder="/audio/takbeer.mp3" value={form.audioUrl} onChange={(e) => set("audioUrl", e.target.value)} maxLength={400} />
          <p className="hint">ضع ملف التكبيرات الذي تملك حق استخدامه في المجلد <code dir="ltr">public/audio/</code> ثم اكتب مساره هنا. يُستعمل لكل الصلوات عدا الفجر إن حُدّد له ملف في الخانة التالية. روابط درايف غير مدعومة. فارغ = نافذة بلا صوت لتلك الصلاة. يبدأ الصوت فور ظهور النافذة؛ وإن منعه المتصفح (قبل أي تفاعل للزائر مع الموقع) يبدأ صامتًا ثم يُفتح عند أول لمسة، وتظهر أيقونة 🔊 لإيقافه.</p>
        </div>
        <div className="field">
          <label htmlFor="ad-audio-fajr">أذان الفجر: رابط مباشر لملف (mp3) أو مساره داخل الموقع</label>
          <input id="ad-audio-fajr" dir="ltr" placeholder="/audio/fajr.mp3" value={form.fajrAudioUrl} onChange={(e) => set("fajrAudioUrl", e.target.value)} maxLength={400} />
          <p className="hint">يُستعمل لصلاة الفجر فقط، وباقي الصلوات تستعمل ملف التكبيرات أعلاه. الملف المدمج في المشروع: <code dir="ltr">/audio/fajr.mp3</code>. فارغ = يُستعمل ملف التكبيرات العام للفجر أيضًا.</p>
        </div>
        <div className="field">
          <label htmlFor="ad-vol">مستوى الصوت: {form.volume}%</label>
          <input id="ad-vol" type="range" min={0} max={100} value={form.volume} onChange={(e) => set("volume", Number(e.target.value))} />
        </div>
      </section>
      </MovableSection>

      <MovableSection id="sound.adhan"><SoundSettings /></MovableSection>

      <OwnerFooter>
      <div className="addrow">
        <button type="button" className="btn btn--ghost" onClick={() => { setTest(form.countdownMin * 60); if (settings.sounds.adhan && audioSources(cleanAdhan(form), "dhuhr").length === 0) playAlert("adhan", settings.sounds.volume); }}>تجربة النافذة</button>
      </div>

      {remindTest && (
        <AdhanRemind text={form.remindText} prayerLabel="الظهر" minutes={form.remindMin.dhuhr || 5} onClose={() => setRemindTest(false)} />
      )}

      {test !== null && (
        <div className="adhan-overlay">
          <AdhanCard cfg={{ ...cleanAdhan(form), closable: true }} prayerLabel="الظهر" prayerId="dhuhr" remainingSec={test} playAudio onClose={() => setTest(null)} />
        </div>
      )}
      </OwnerFooter>
    </>
  );
}
