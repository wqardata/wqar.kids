"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import AdhanCard from "@/components/AdhanCard";
import type { AdhanSettings } from "@/lib/adhanCore";
import AdhanRemind from "@/components/AdhanRemind";
import { applyPrefs, effectiveCoords, useAdhanPrefs, DENIED_KEY, POS_KEY } from "@/lib/adhanPrefs";
import { slotsAround, type Slot } from "@/lib/prayer";
import { useSettings } from "@/lib/settings";

const doneKey = (s: Slot) => `adhan-done:${s.id}:${s.at.getTime()}`;
const remindKey = (s: Slot) => `adhan-remind-done:${s.id}:${s.at.getTime()}`;
/** نحاول تشغيل الصوت تلقائيًا فقط إن فُتحت الصفحة خلال هذه المدة من الأذان. */
const AUTOPLAY_WINDOW_MS = 90_000;

/** نافذة الأذان: تظهر عند دخول وقت كل صلاة وتعدّ تنازليًا ثم تختفي. */
export default function AdhanPopup() {
  const { settings } = useSettings();
  const prefs = useAdhanPrefs();
  const cfg = useMemo(() => applyPrefs(settings.adhan, prefs), [settings.adhan, prefs]);
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
  }, [cfg.enabled, cfg.locationMode, prefs]);

  useEffect(() => {
    if (!cfg.enabled) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cfg.enabled]);

  // تلقائي: موقع الجهاز بإذن الزائر، وإن لم يُمنح فتقدير من منطقته الزمنية؛ المدينة المضبوطة هي الاحتياط الأخير.
  const coords = effectiveCoords(cfg, auto);
  const slots = useMemo(
    () => (cfg.enabled ? slotsAround(new Date(now), coords.lat, coords.lng, cfg) : []),
    // نُعيد الحساب كل دقيقة فقط (المواقيت لا تتغير بين الثواني).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, coords.lat, coords.lng, Math.floor(now / 60_000)],
  );

  if (!cfg.enabled) return null;
  const windowMs = cfg.countdownMin * 60_000;
  const active = [...slots].reverse().find((s) => s.at.getTime() <= now && now - s.at.getTime() < windowMs && cfg.prayers[s.id]);
  if (!active) return <Reminder cfg={cfg} slots={slots} now={now} />;
  const key = doneKey(active);
  let dismissed = closed === key;
  try { dismissed = dismissed || localStorage.getItem(key) === "1"; } catch { /* لا بأس */ }
  if (dismissed) return <Reminder cfg={cfg} slots={slots} now={now} />;

  const close = () => {
    setClosed(key);
    try { localStorage.setItem(key, "1"); } catch { /* لا بأس */ }
  };
  return (
    <div className="adhan-overlay">
      <AdhanLock />
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

/** تنبيه «اقتربت صلاة …» قبل الموعد بالدقائق المضبوطة لكل صلاة. */
function Reminder({ cfg, slots, now }: { cfg: AdhanSettings; slots: Slot[]; now: number }) {
  const [closed, setClosed] = useState("");
  if (!cfg.remind) return null;
  const next = slots.find((s) => {
    const left = s.at.getTime() - now;
    const min = cfg.remindMin[s.id];
    return cfg.prayers[s.id] && min > 0 && left > 0 && left <= min * 60_000;
  });
  if (!next) return null;
  const key = remindKey(next);
  let dismissed = closed === key;
  try { dismissed = dismissed || localStorage.getItem(key) === "1"; } catch { /* لا بأس */ }
  if (dismissed) return null;
  const close = () => {
    setClosed(key);
    try { localStorage.setItem(key, "1"); } catch { /* لا بأس */ }
  };
  return <AdhanRemind text={cfg.remindText} prayerLabel={next.label} minutes={Math.max(1, Math.ceil((next.at.getTime() - now) / 60_000))} onClose={close} />;
}

/**
 * أثناء شاشة الأذان لا يمكن تصفّح الموقع خلفها: نمنع تمرير الصفحة ونجعل كل ما عداها «inert»
 * (لا نقر ولا تنقّل بلوحة المفاتيح ولا قارئ شاشة). يزول كل ذلك عند إغلاق الشاشة أو انتهاء العدّ.
 */
function AdhanLock() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const me = ref.current?.parentElement;
    if (!me) return;
    const locked: Element[] = [];
    let node: Element | null = me;
    while (node && node !== document.documentElement) {
      const parent: Element | null = node.parentElement;
      if (!parent) break;
      for (const sib of Array.from(parent.children)) {
        if (sib === node || sib.hasAttribute("inert") || /^(SCRIPT|STYLE|LINK|NOSCRIPT)$/.test(sib.tagName)) continue;
        sib.setAttribute("inert", "");
        locked.push(sib);
      }
      node = parent;
    }
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      for (const el of locked) el.removeAttribute("inert");
      document.documentElement.style.overflow = prev;
    };
  }, []);
  return <span ref={ref} hidden />;
}
