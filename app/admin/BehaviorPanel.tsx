"use client";
import { useState } from "react";
import { saveSettings, useSettings } from "@/lib/settings";

/** خيارات سلوك الموقع: شاشة الشعار عند فتح الرئيسية، والتشغيل التلقائي للفيديو. */
export default function BehaviorPanel() {
  const { settings, update, ready } = useSettings();
  const [splash, setSplash] = useState(settings.splash);
  const [autoplay, setAutoplay] = useState(settings.autoplay);
  const [skipSec, setSkipSec] = useState(settings.skipDefaultSec);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const saved = await saveSettings({ ...settings, splash, autoplay, skipDefaultSec: skipSec });
      update(saved);
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return null;
  return (
    <div className="admin-stack">
    <section className="panel menu-admin" aria-labelledby="bh-h-splash">
      <h2 id="bh-h-splash">شاشة الشعار</h2>
      <label className="check">
        <input type="checkbox" checked={splash} onChange={(e) => { setSplash(e.target.checked); setDone(false); }} />
        إظهار شعار الموقع في المنتصف لثانية عند فتح الصفحة الرئيسية
      </label>
    </section>
    <section className="panel menu-admin" aria-labelledby="bh-h-play">
      <h2 id="bh-h-play">تشغيل الفيديو</h2>
      <label className="check">
        <input type="checkbox" checked={autoplay} onChange={(e) => { setAutoplay(e.target.checked); setDone(false); }} />
        تشغيل الفيديو تلقائيًا عند فتح صفحته
      </label>
      <p className="hint">التشغيل التلقائي طلبٌ للمشغّل؛ قد تمنعه بعض المتصفحات (خاصة الجوال) أو مشغّل درايف نفسه.</p>
      <div className="field">
        <label htmlFor="bh-skip">زر «تخطي» في بداية كل فيديو: {skipSec === 0 ? "معطّل" : `${skipSec} ثانية`}</label>
        <input id="bh-skip" type="range" min={0} max={180} step={5} value={skipSec} onChange={(e) => { setSkipSec(Number(e.target.value)); setDone(false); }} />
        <p className="hint">يظهر الزر فوق المشغّل في بداية الفيديو ويقفز إلى هذه الثانية. لفيديو مقدمته أطول أو أقصر اضبط ثانيته من تعديل الفيديو.</p>
      </div>
    </section>
      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم الحفظ ✓</p>}
      <div className="addrow">
        <button type="button" className="btn" onClick={() => void save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </div>
  );
}
