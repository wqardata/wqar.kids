"use client";
import { useEffect, useState } from "react";
import AdhanCard from "@/components/AdhanCard";
import AdhanRemind from "@/components/AdhanRemind";
import { PRAYERS, type PrayerId } from "@/lib/adhanCore";
import { useSettings } from "@/lib/settings";
import "../screens.css";

/**
 * شاشة الأذان كما يراها الزائر (النافذة بالصورة والنص والعدّاد، أو فقاعة «اقتربت صلاة …»).
 * تُعرض داخل إطار المعاينة في لوحة التحكم، وتتبع إعدادات تبويب الأذان قبل حفظها (يطبّقها PreviewReceiver).
 */
export default function AdhanScreen() {
  const { settings } = useSettings();
  const cfg = settings.adhan;
  const [mode, setMode] = useState<"window" | "remind">("window");
  const [prayer, setPrayer] = useState<PrayerId>("maghrib");
  const [open, setOpen] = useState(true);
  const full = Math.max(1, cfg.countdownMin) * 60;
  const [left, setLeft] = useState(full);
  const [bubble, setBubble] = useState(true);

  useEffect(() => setLeft(full), [full]);
  // العدّاد يدور بلا توقف لتبقى المعاينة حيّة.
  useEffect(() => {
    if (mode !== "window" || !open) return;
    const t = setInterval(() => setLeft((s) => (s <= 1 ? full : s - 1)), 1000);
    return () => clearInterval(t);
  }, [mode, open, full]);

  const label = PRAYERS.find((p) => p.id === prayer)?.label ?? "";
  const remindMin = Math.max(1, cfg.remindMin[prayer] || 10);

  return (
    <div className="pvscreen">
      <div className="pvs-bar" role="toolbar" aria-label="خيارات المعاينة">
        <div className="range-seg" role="group" aria-label="الشاشة">
          <button type="button" className={mode === "window" ? "on" : undefined} aria-pressed={mode === "window"} onClick={() => { setMode("window"); setOpen(true); }}>نافذة الأذان</button>
          <button type="button" className={mode === "remind" ? "on" : undefined} aria-pressed={mode === "remind"} onClick={() => { setMode("remind"); setBubble(true); }}>التنبيه قبل الأذان</button>
        </div>
        <select value={prayer} onChange={(e) => setPrayer(e.target.value as PrayerId)} aria-label="الصلاة المعروضة">
          {PRAYERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {mode === "window" && !cfg.enabled && <span className="pvs-off">النافذة معطّلة حاليًا</span>}
        {mode === "remind" && !cfg.remind && <span className="pvs-off">التنبيه معطّل حاليًا</span>}
      </div>

      {mode === "window" ? (
        open ? (
          <div className="adhan-overlay">
            <AdhanCard cfg={cfg} prayerLabel={label} prayerId={prayer} remainingSec={left} playAudio={false} onClose={() => setOpen(false)} />
          </div>
        ) : (
          <div className="pvscreen-note">
            <strong>أُغلقت النافذة</strong>
            <span>هكذا تختفي عند ضغط الزائر على ✕ (أو عند انتهاء العدّاد).</span>
            <button type="button" className="btn btn--ghost" onClick={() => { setLeft(full); setOpen(true); }}>↻ إعادة عرض النافذة</button>
          </div>
        )
      ) : (
        <>
          <div className="pvscreen-note">
            <strong>هكذا يظهر التنبيه أسفل الموقع</strong>
            <span>يظهر قبل موعد {label} بـ {remindMin} دقيقة دون أن يحجب الموقع.</span>
            {!bubble && <button type="button" className="btn btn--ghost" onClick={() => setBubble(true)}>↻ إعادة عرض التنبيه</button>}
          </div>
          {bubble && <AdhanRemind text={cfg.remindText} prayerLabel={label} minutes={remindMin} onClose={() => setBubble(false)} />}
        </>
      )}
    </div>
  );
}
