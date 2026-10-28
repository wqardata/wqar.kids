"use client";
import { useMemo, useState } from "react";
import { DEFAULT_SETTINGS, cleanSounds, useSettings, type SoundSettings as Sounds } from "@/lib/settings";
import { playAlert, type AlertKind } from "@/lib/sounds";
import { useSettingsOwner } from "./saveKit";

const ROWS: { key: "notify" | "remind" | "adhan"; kind: AlertKind; label: string }[] = [
  { key: "notify", kind: "notify", label: "عند وصول إشعار جديد" },
  { key: "remind", kind: "remind", label: "عند ظهور تنبيه «اقتربت صلاة …»" },
  { key: "adhan", kind: "adhan", label: "عند ظهور نافذة الأذان (إن لم يُضبط ملف تكبيرات؛ الملف له صوته)" },
];

/** أصوات التنبيه: تُستعمل في تبويبي «الإشعارات» و«الأذان» وتُحفظ مع باقي التبويب من شريط الحفظ. */
export default function SoundSettings() {
  const { settings } = useSettings();
  const [form, setForm] = useState<Sounds>(settings.sounds);
  const patch = useMemo(() => ({ sounds: cleanSounds(form) }), [form]);
  useSettingsOwner({
    patch,
    afterSave: (saved) => setForm(saved.sounds),
    reset: () => setForm(DEFAULT_SETTINGS.sounds),
  });

  return (
    <section className="panel auth-form" aria-labelledby="snd-h">
      <h2 id="snd-h">أصوات التنبيه</h2>
      {ROWS.map((r) => (
        <div className="addrow" key={r.key}>
          <label className="check">
            <input type="checkbox" checked={form[r.key]} onChange={(e) => setForm((f) => ({ ...f, [r.key]: e.target.checked }))} /> {r.label}
          </label>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => playAlert(r.kind, form.volume)}>تجربة</button>
        </div>
      ))}
      <div className="field">
        <label htmlFor="snd-vol">مستوى صوت التنبيهات: {form.volume}%</label>
        <input id="snd-vol" type="range" min={0} max={100} value={form.volume} onChange={(e) => setForm((f) => ({ ...f, volume: Number(e.target.value) }))} />
      </div>
      <p className="hint">المتصفحات تمنع أي صوت قبل أن يتفاعل الزائر مع الصفحة (نقرة أو لمسة)، فأول تنبيه قبل ذلك يصل بلا صوت. لا يُشغَّل صوت للإشعارات الموجودة عند فتح الموقع، بل لما يصل أثناء فتحه.</p>
    </section>
  );
}
