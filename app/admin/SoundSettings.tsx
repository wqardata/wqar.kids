"use client";
import { useState } from "react";
import { cleanSounds, saveSettings, useSettings, type SoundSettings as Sounds } from "@/lib/settings";
import { playAlert, type AlertKind } from "@/lib/sounds";

const ROWS: { key: "notify" | "remind" | "adhan"; kind: AlertKind; label: string }[] = [
  { key: "notify", kind: "notify", label: "عند وصول إشعار جديد" },
  { key: "remind", kind: "remind", label: "عند ظهور تنبيه «اقتربت صلاة …»" },
  { key: "adhan", kind: "adhan", label: "عند ظهور نافذة الأذان (إن لم يُضبط ملف تكبيرات؛ الملف له صوته)" },
];

/** أصوات التنبيه: تُستعمل في تبويبي «الإشعارات» و«الأذان» وتُحفظ بزرها الخاص. */
export default function SoundSettings() {
  const { settings, update } = useSettings();
  const [form, setForm] = useState<Sounds>(settings.sounds);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(settings.sounds);

  async function save() {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const saved = await saveSettings({ ...settings, sounds: cleanSounds(form) });
      update(saved);
      setForm(saved.sounds);
      setMsg("تم حفظ إعدادات الأصوات ✓");
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel auth-form" aria-labelledby="snd-h">
      <h2 id="snd-h">أصوات التنبيه {dirty && <span className="dirty-dot">● تعديلات غير محفوظة</span>}</h2>
      {ROWS.map((r) => (
        <div className="addrow" key={r.key}>
          <label className="check">
            <input type="checkbox" checked={form[r.key]} onChange={(e) => { setMsg(""); setForm((f) => ({ ...f, [r.key]: e.target.checked })); }} /> {r.label}
          </label>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => playAlert(r.kind, form.volume)}>تجربة</button>
        </div>
      ))}
      <div className="field">
        <label htmlFor="snd-vol">مستوى صوت التنبيهات: {form.volume}%</label>
        <input id="snd-vol" type="range" min={0} max={100} value={form.volume} onChange={(e) => { setMsg(""); setForm((f) => ({ ...f, volume: Number(e.target.value) })); }} />
      </div>
      <p className="hint">المتصفحات تمنع أي صوت قبل أن يتفاعل الزائر مع الصفحة (نقرة أو لمسة)، فأول تنبيه قبل ذلك يصل بلا صوت. لا يُشغَّل صوت للإشعارات الموجودة عند فتح الموقع، بل لما يصل أثناء فتحه.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      {msg && <p className="hint" role="status">{msg}</p>}
      <div className="addrow">
        <button type="button" className="btn" onClick={() => void save()} disabled={busy || !dirty}>{busy ? "جارٍ الحفظ…" : "حفظ إعدادات الأصوات"}</button>
      </div>
    </section>
  );
}
