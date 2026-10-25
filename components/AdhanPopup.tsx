"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import AdhanCard from "@/components/AdhanCard";
import type { AdhanSettings } from "@/lib/adhanCore";
import type { SoundSettings } from "@/lib/settingsCore";
import AdhanRemind from "@/components/AdhanRemind";
import { useAutoLocation } from "@/lib/adhanLocation";
import { slotsAround, type Slot } from "@/lib/prayer";
import { setAdhanOpen } from "@/lib/adhanOpen";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { armSounds, playAlert } from "@/lib/sounds";

// مفتاح «تم إغلاقها» = الصلاة + تاريخ اليوم (لا اللحظة بالضبط). كان المفتاح يحوي اللحظة بالثواني، فإذا تغيّر الموقع التقديري
// (المنطقة الزمنية ← موقع الجهاز) تحرّكت اللحظة دقائق وضاع الإغلاق المحفوظ فعادت النافذة بعد إغلاقها أو عند كل فتح للصفحة.
const dayOf = (s: Slot, lng: number) => new Date(s.at.getTime() + (lng / 15) * 3600_000).toISOString().slice(0, 10);
const doneKey = (s: Slot, lng: number) => `adhan-done:${s.id}:${dayOf(s, lng)}`;
const remindKey = (s: Slot, lng: number) => `adhan-remind-done:${s.id}:${dayOf(s, lng)}`;
/** نحاول تشغيل الصوت تلقائيًا فقط إن فُتحت الصفحة خلال هذه المدة من الأذان. */
const AUTOPLAY_WINDOW_MS = 90_000;

/** نافذة الأذان: تظهر عند دخول وقت كل صلاة وتعدّ تنازليًا ثم تختفي. الموقع وجهة الحساب تلقائيان لكل زائر. */
export default function AdhanPopup() {
  const { settings } = useSettings();
  const { canAdd, loading } = useAuth();
  const cfg = settings.adhan;
  // المشرف لا يرى النافذة ولا التنبيه إلا إن فُعِّل «إظهارها للمشرفين» (الافتراضي معطّل). ننتظر معرفة حالة الدخول كي لا تومض له.
  const hiddenForMe = loading || (canAdd && !cfg.adminShow);
  const [now, setNow] = useState<number>(() => Date.now());
  const [closed, setClosed] = useState<string>("");
  // موقع الجهاز (بإذن الزائر) ثم تقدير المنطقة الزمنية. لا نعرض شيئًا قبل أول قراءة كي لا تومض نافذة بمواقيت مؤقتة.
  const { coords, ready } = useAutoLocation(cfg.enabled);

  useEffect(() => {
    if (!cfg.enabled) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cfg.enabled]);

  const slots = useMemo(
    () => (cfg.enabled ? slotsAround(new Date(now), coords.lat, coords.lng) : []),
    // نُعيد الحساب كل دقيقة فقط (المواقيت لا تتغير بين الثواني).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg.enabled, coords.lat, coords.lng, Math.floor(now / 60_000)],
  );

  useEffect(() => armSounds(), []);

  if (!cfg.enabled || !ready || hiddenForMe) return null;
  const windowMs = cfg.countdownMin * 60_000;
  const active = [...slots].reverse().find((s) => s.at.getTime() <= now && now - s.at.getTime() < windowMs && cfg.prayers[s.id]);
  if (!active) return <Reminder cfg={cfg} slots={slots} now={now} lng={coords.lng} sound={settings.sounds} />;
  const key = doneKey(active, coords.lng);
  let dismissed = closed === key;
  try { dismissed = dismissed || localStorage.getItem(key) === "1"; } catch { /* لا بأس */ }
  if (dismissed) return <Reminder cfg={cfg} slots={slots} now={now} lng={coords.lng} sound={settings.sounds} />;

  const close = () => {
    setClosed(key);
    try { localStorage.setItem(key, "1"); } catch { /* لا بأس */ }
  };
  return (
    <div className="adhan-overlay">
      <AdhanLock />
      <AdhanOpenFlag />
      <AdhanChime enabled={settings.sounds.adhan && !cfg.audioUrl && now - active.at.getTime() < AUTOPLAY_WINDOW_MS} volume={settings.sounds.volume} />
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

/** نغمة تنبيه عند ظهور نافذة الأذان (إن لم يكن هناك ملف تكبيرات يُشغَّل بنفسه). */
function AdhanChime({ enabled, volume }: { enabled: boolean; volume: number }) {
  useEffect(() => {
    if (enabled) playAlert("adhan", volume);
    // مرة واحدة عند ظهور النافذة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** نغمة عند ظهور تنبيه «اقتربت صلاة …». */
function RemindChime({ enabled, volume }: { enabled: boolean; volume: number }) {
  useEffect(() => {
    if (enabled) playAlert("remind", volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** يعلن أن شاشة الأذان مفتوحة ما دام موجودًا (تستعمله إشعارات الأذكار لتنتظر). */
function AdhanOpenFlag() {
  useEffect(() => {
    setAdhanOpen(true);
    return () => setAdhanOpen(false);
  }, []);
  return null;
}

/** تنبيه «اقتربت صلاة …» قبل الموعد بالدقائق المضبوطة لكل صلاة. */
function Reminder({ cfg, slots, now, lng, sound }: { cfg: AdhanSettings; slots: Slot[]; now: number; lng: number; sound: SoundSettings }) {
  const [closed, setClosed] = useState("");
  if (!cfg.remind) return null;
  const next = slots.find((s) => {
    const left = s.at.getTime() - now;
    const min = cfg.remindMin[s.id];
    return cfg.prayers[s.id] && min > 0 && left > 0 && left <= min * 60_000;
  });
  if (!next) return null;
  const key = remindKey(next, lng);
  let dismissed = closed === key;
  try { dismissed = dismissed || localStorage.getItem(key) === "1"; } catch { /* لا بأس */ }
  if (dismissed) return null;
  const close = () => {
    setClosed(key);
    try { localStorage.setItem(key, "1"); } catch { /* لا بأس */ }
  };
  return (
    <>
      <RemindChime key={key} enabled={sound.remind} volume={sound.volume} />
      <AdhanRemind text={cfg.remindText} prayerLabel={next.label} minutes={Math.max(1, Math.ceil((next.at.getTime() - now) / 60_000))} onClose={close} />
    </>
  );
}

/**
 * أثناء شاشة الأذان لا يمكن تصفّح الموقع خلفها: نمنع تمرير الصفحة ونجعل كل ما عداها «inert»
 * (لا نقر ولا تنقّل بلوحة المفاتيح ولا قارئ شاشة). يزول كل ذلك عند إغلاق الشاشة أو انتهاء العدّ.
 */
export function AdhanLock() {
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
