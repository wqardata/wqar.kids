"use client";
import { useState } from "react";
import { saveSettings, useSettings } from "@/lib/settings";

/** خيارات سلوك الموقع: شاشة الشعار عند فتح الرئيسية، والتشغيل التلقائي للفيديو. */
export default function BehaviorPanel() {
  const { settings, update, ready } = useSettings();
  const [splash, setSplash] = useState(settings.splash);
  const [autoplay, setAutoplay] = useState(settings.autoplay);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const saved = await saveSettings({ ...settings, splash, autoplay });
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
    <div className="panel menu-admin">
      <h2>سلوك الموقع</h2>
      <label className="check">
        <input type="checkbox" checked={splash} onChange={(e) => { setSplash(e.target.checked); setDone(false); }} />
        إظهار شعار الموقع في المنتصف لثانية عند فتح الصفحة الرئيسية
      </label>
      <label className="check">
        <input type="checkbox" checked={autoplay} onChange={(e) => { setAutoplay(e.target.checked); setDone(false); }} />
        تشغيل الفيديو تلقائيًا عند فتح صفحته
      </label>
      <p className="hint">التشغيل التلقائي طلبٌ للمشغّل؛ قد تمنعه بعض المتصفحات (خاصة الجوال) أو مشغّل درايف نفسه.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم الحفظ ✓</p>}
      <div className="addrow">
        <button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </div>
  );
}
