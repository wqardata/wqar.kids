"use client";
import { useEffect, useMemo, useState } from "react";
import AdhanCard from "@/components/AdhanCard";
import { configuredCoords } from "@/lib/adhanCore";
import { slotsAround, type Slot } from "@/lib/prayer";
import { useSettings } from "@/lib/settings";
import { approxFromTimezone } from "@/lib/tzLocation";

const POS_KEY = "adhan-pos";
const DENIED_KEY = "adhan-geo-denied";
const doneKey = (s: Slot) => `adhan-done:${s.id}:${s.at.getTime()}`;
/** نحاول تشغيل الصوت تلقائيًا فقط إن فُتحت الصفحة خلال هذه المدة من الأذان. */
const AUTOPLAY_WINDOW_MS = 90_000;

/** نافذة الأذان: تظهر عند دخول وقت كل صلاة وتعدّ تنازليًا ثم تختفي. */
export default function AdhanPopup() {
  const { settings } = useSettings();
  const cfg = settings.adhan;
  const [auto, setAuto] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [closed, setClosed] = useState<string>("");

  // موقع الجهاز: نستعمل المحفوظ أولًا ثم نطلبه مرة واحدة (إن رفض الزائر نعود للمدينة المضبوطة).
  useEffect(() => {
    if (!cfg.enabled || cfg.locationMode !== "auto") return;
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as { lat: number; lng: number } | null;
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) setAuto(saved);
      if (localStorage.getItem(DENIED_KEY) || saved || !navigator.geolocation) return;
    } catch {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setAuto(pos);
        try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* لا بأس */ }
      },
      () => { try { localStorage.setItem(DENIED_KEY, "1"); } catch { /* لا بأس */ } },
      { maximumAge: 86_400_000, timeout: 10_000 },
    );
  }, [cfg.enabled, cfg.locationMode]);

  useEffect(() => {
    if (!cfg.enabled) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cfg.enabled]);

  // تلقائي: موقع الجهاز بإذن الزائر، وإن لم يُمنح فتقدير من منطقته الزمنية؛ المدينة المضبوطة هي الاحتياط الأخير.
  const coords =
    cfg.locationMode === "auto" ? (auto ?? (typeof window !== "undefined" ? approxFromTimezone() : null) ?? configuredCoords(cfg)) : configuredCoords(cfg);
  const slots = useMemo(
    () => (cfg.enabled ? slotsAround(new Date(now), coords.lat, coords.lng, cfg) : []),
    // نُعيد الحساب كل دقيقة فقط (المواقيت لا تتغير بين الثواني).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, coords.lat, coords.lng, Math.floor(now / 60_000)],
  );

  if (!cfg.enabled) return null;
  const windowMs = cfg.countdownMin * 60_000;
  const active = [...slots].reverse().find((s) => s.at.getTime() <= now && now - s.at.getTime() < windowMs && cfg.prayers[s.id]);
  if (!active) return null;
  const key = doneKey(active);
  let dismissed = closed === key;
  try { dismissed = dismissed || localStorage.getItem(key) === "1"; } catch { /* لا بأس */ }
  if (dismissed) return null;

  const close = () => {
    setClosed(key);
    try { localStorage.setItem(key, "1"); } catch { /* لا بأس */ }
  };
  return (
    <div className="adhan-overlay">
      <AdhanCard
        cfg={cfg}
        prayerLabel={active.label}
        remainingSec={(active.at.getTime() + windowMs - now) / 1000}
        playAudio={now - active.at.getTime() < AUTOPLAY_WINDOW_MS}
        onClose={close}
      />
    </div>
  );
}
