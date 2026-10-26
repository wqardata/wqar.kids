"use client";
import { useState } from "react";
import { saveSettings, useSettings } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerFooter, OwnerForm } from "./sectionKit";

/** خيارات سلوك الموقع: التشغيل التلقائي للفيديو. (شاشة الشعار صارت في «المظهر».) */
export default function BehaviorPanel() {
  const { settings, update, ready } = useSettings();
  const [autoplay, setAutoplay] = useState(settings.autoplay);
  usePreviewDraft("behavior", { autoplay });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const saved = await saveSettings({ ...settings, autoplay });
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
    <>
    <MovableSection id="behavior.play">
    <section className="panel menu-admin" aria-labelledby="bh-h-play">
      <h2 id="bh-h-play">تشغيل الفيديو</h2>
      <label className="check">
        <input type="checkbox" checked={autoplay} onChange={(e) => { setAutoplay(e.target.checked); setDone(false); }} />
        تشغيل الفيديو تلقائيًا عند فتح صفحته
      </label>
      <p className="hint">التشغيل التلقائي طلبٌ للمشغّل؛ قد تمنعه بعض المتصفحات (خاصة الجوال) أو مشغّل درايف نفسه.</p>
    </section>
    </MovableSection>
    <OwnerFooter>
      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم الحفظ ✓</p>}
      <div className="addrow">
        <button type="button" className="btn" onClick={() => void save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </OwnerFooter>
    </>
  );
}
