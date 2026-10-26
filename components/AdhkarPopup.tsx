"use client";
import { useEffect, useMemo, useState } from "react";
import AdhkarPrompt from "@/components/AdhkarPrompt";
import AdhkarReader from "@/components/AdhkarReader";
import { ADHKAR_KINDS, SNOOZE_MIN, activeAdhkarWindow, adhkarDoneKey, adhkarSnoozeKey, type AdhkarWindow } from "@/lib/adhkarCore";
import { useAutoLocation } from "@/lib/adhanLocation";
import { slotsAround } from "@/lib/prayer";
import { useSettings } from "@/lib/settings";
import { useAdhanOpen } from "@/lib/adhanOpen";

function flag(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/**
 * أذكار الصباح (من أذان الفجر حتى العاشرة) والمساء (من أذان العصر حتى المغرب):
 * إشعار منبثق فيه «قلتها / سأقولها الآن»، و«سأقولها الآن» يفتح القارئ بملء الشاشة.
 * المواقيت تُحسب تلقائيًا بموقع الزائر وبالطريقة نفسها المستعملة في نافذة الأذان.
 */
export default function AdhkarPopup() {
  const { settings } = useSettings();
  const ak = settings.adhkar;
  const [now, setNow] = useState<number>(() => Date.now());
  /** نوافذ أنهاها الزائر في هذه الجلسة (ليختفي الإشعار فورًا دون انتظار إعادة القراءة). */
  const [hidden, setHidden] = useState<string[]>([]);
  /** تأجيلات هذه الجلسة (احتياط إن تعذّر التخزين المحلي). */
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [reading, setReading] = useState<AdhkarWindow | null>(null);
  const adhanOpen = useAdhanOpen();

  useEffect(() => {
    if (!ak.enabled) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [ak.enabled]);

  // الموقع تلقائي: موقع الجهاز بإذن الزائر (تتشارك الطلب مع نافذة الأذان) ثم تقدير المنطقة الزمنية.
  const minute = Math.floor(now / 60_000);
  const { coords, ready } = useAutoLocation(ak.enabled);
  const slots = useMemo(
    () => (ak.enabled && ready ? slotsAround(new Date(now), coords.lat, coords.lng) : []),
    // المواقيت لا تتغير بين الدقائق.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ak.enabled, ready, coords.lat, coords.lng, minute],
  );

  const win = useMemo(() => activeAdhkarWindow(ak, slots, now), [ak, slots, now]);

  const kindOf = (w: AdhkarWindow) => ADHKAR_KINDS.find((k) => k.id === w.kind)!;
  const markDone = (w: AdhkarWindow) => {
    try { localStorage.setItem(adhkarDoneKey(w), "1"); } catch { /* لا بأس */ }
    setHidden((h) => [...h, adhkarDoneKey(w)]);
  };
  const snooze = (w: AdhkarWindow) => {
    const until = Date.now() + SNOOZE_MIN * 60_000;
    try { localStorage.setItem(adhkarSnoozeKey(w), String(until)); } catch { /* لا بأس */ }
    setSnoozed((m) => ({ ...m, [adhkarSnoozeKey(w)]: until }));
  };

  // شاشة الأذان تقفل ما خلفها: ننتظر إغلاقها ثم يعود الإشعار (أو القارئ) كما كان.
  if (adhanOpen) return null;

  if (reading) {
    const k = kindOf(reading);
    return (
      <AdhkarReader
        title={k.label}
        icon={k.icon}
        items={reading.kind === "morning" ? ak.morning : ak.evening}
        onClose={() => setReading(null)}
        onFinish={() => { markDone(reading); setReading(null); }}
      />
    );
  }

  if (!win) return null;
  const doneKey = adhkarDoneKey(win);
  if (hidden.includes(doneKey) || flag(doneKey) === "1") return null;
  const sk = adhkarSnoozeKey(win);
  if (Math.max(Number(flag(sk) ?? 0), snoozed[sk] ?? 0) > now) return null;

  const k = kindOf(win);
  return (
    <AdhkarPrompt
      icon={k.icon}
      text={win.kind === "morning" ? ak.morningText : ak.eveningText}
      onDone={() => markDone(win)}
      onNow={() => setReading(win)}
      onLater={() => snooze(win)}
    />
  );
}
