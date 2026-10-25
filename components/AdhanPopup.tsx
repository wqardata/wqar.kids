"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import AdhanCard from "@/components/AdhanCard";
import type { AdhanSettings } from "@/lib/adhanCore";
import AdhanRemind from "@/components/AdhanRemind";
import { applyPrefs, effectiveCoords, loadRemotePrefs, savePrefs, useAdhanPrefs, DENIED_KEY, POS_KEY } from "@/lib/adhanPrefs";
import { slotsAround, type Slot } from "@/lib/prayer";
import { useAuth } from "@/lib/auth";
import { setAdhanOpen } from "@/lib/adhanOpen";
import { useSettings } from "@/lib/settings";

// مفتاح «تم إغلاقها» = الصلاة + تاريخ اليوم (لا اللحظة بالضبط). كان المفتاح يحوي اللحظة بالثواني، فإذا تغيّر الموقع التقديري
// (المنطقة الزمنية ← موقع الجهاز) تحرّكت اللحظة دقائق وضاع الإغلاق المحفوظ فعادت النافذة بعد إغلاقها أو عند كل فتح للصفحة.
const dayOf = (s: Slot, lng: number) => new Date(s.at.getTime() + (lng / 15) * 3600_000).toISOString().slice(0, 10);
const doneKey = (s: Slot, lng: number) => `adhan-done:${s.id}:${dayOf(s, lng)}`;
const remindKey = (s: Slot, lng: number) => `adhan-remind-done:${s.id}:${dayOf(s, lng)}`;
/** نحاول تشغيل الصوت تلقائيًا فقط إن فُتحت الصفحة خلال هذه المدة من الأذان. */
const AUTOPLAY_WINDOW_MS = 90_000;

/** نافذة الأذان: تظهر عند دخول وقت كل صلاة وتعدّ تنازليًا ثم تختفي. */
export default function AdhanPopup() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const prefs = useAdhanPrefs();
  // عند الدخول من جهاز جديد نجلب تفضيلات الحساب المحفوظة ونعتمدها.
  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!uid) return;
    let off = false;
    void loadRemotePrefs(uid).then((p) => !off && p && savePrefs(p));
    return () => {
      off = true;
    };
  }, [uid]);
  const cfg = useMemo(() => applyPrefs(settings.adhan, prefs), [settings.adhan, prefs]);
  const [auto, setAuto] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [closed, setClosed] = useState<string>("");
  // لا نعرض شيئًا قبل أن يستقر الموقع (المحفوظ أو التقديري) كي لا تومض نافذة بمواقيت مؤقتة ثم تتغير.
  const [ready, setReady] = useState(false);

  // موقع الجهاز: نستعمل المحفوظ أولًا ثم نطلبه مرة واحدة (إن رفض الزائر نعود للمدينة المضبوطة).
  useEffect(() => {
    if (!cfg.enabled || cfg.locationMode !== "auto") {
      setReady(true);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as { lat: number; lng: number } | null;
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) setAuto(saved);
      if (localStorage.getItem(DENIED_KEY) || saved || !navigator.geolocation) {
        setReady(true);
        return;
      }
    } catch {
      setReady(true);
      return;
    }
    setReady(true); // نعرض بالتقدير الآن؛ إن وصل الموقع الحقيقي فلن يؤثر على ما أُغلق (المفتاح لا يعتمد على اللحظة)
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

  if (!cfg.enabled || !ready) return null;
  const windowMs = cfg.countdownMin * 60_000;
  const active = [...slots].reverse().find((s) => s.at.getTime() <= now && now - s.at.getTime() < windowMs && cfg.prayers[s.id]);
  if (!active) return <Reminder cfg={cfg} slots={slots} now={now} lng={coords.lng} />;
  const key = doneKey(active, coords.lng);
  let dismissed = closed === key;
  try { dismissed = dismissed || localStorage.getItem(key) === "1"; } catch { /* لا بأس */ }
  if (dismissed) return <Reminder cfg={cfg} slots={slots} now={now} lng={coords.lng} />;

  const close = () => {
    setClosed(key);
    try { localStorage.setItem(key, "1"); } catch { /* لا بأس */ }
  };
  return (
    <div className="adhan-overlay">
      <AdhanLock />
      <AdhanOpenFlag />
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

/** يعلن أن شاشة الأذان مفتوحة ما دام موجودًا (تستعمله إشعارات الأذكار لتنتظر). */
function AdhanOpenFlag() {
  useEffect(() => {
    setAdhanOpen(true);
    return () => setAdhanOpen(false);
  }, []);
  return null;
}

/** تنبيه «اقتربت صلاة …» قبل الموعد بالدقائق المضبوطة لكل صلاة. */
function Reminder({ cfg, slots, now, lng }: { cfg: AdhanSettings; slots: Slot[]; now: number; lng: number }) {
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
  return <AdhanRemind text={cfg.remindText} prayerLabel={next.label} minutes={Math.max(1, Math.ceil((next.at.getTime() - now) / 60_000))} onClose={close} />;
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
