"use client";
import { useEffect, useMemo, useState } from "react";
import AdhkarPrompt from "@/components/AdhkarPrompt";
import AdhkarReader from "@/components/AdhkarReader";
import { ADHKAR_KINDS, SNOOZE_MIN, activeAdhkarWindow, adhkarDoneKey, adhkarSnoozeKey, type AdhkarWindow } from "@/lib/adhkarCore";
import { applyPrefs, effectiveCoords, readSavedPos, useAdhanPrefs } from "@/lib/adhanPrefs";
import { slotsAround } from "@/lib/prayer";
import { useSettings } from "@/lib/settings";

function flag(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/**
 * أذكار الصباح (من أذان الفجر حتى العاشرة) والمساء (من أذان العصر حتى المغرب):
 * إشعار منبثق فيه «قلتها / سأقولها الآن»، و«سأقولها الآن» يفتح القارئ بملء الشاشة.
 * المواقيت تُحسب بموقع الزائر وتفضيلاته نفسها المستعملة في نافذة الأذان.
 */
export default function AdhkarPopup() {
  const { settings } = useSettings();
  const prefs = useAdhanPrefs();
  const ak = settings.adhkar;
  const cfg = useMemo(() => applyPrefs(settings.adhan, prefs), [settings.adhan, prefs]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [auto, setAuto] = useState<{ lat: number; lng: number } | null>(null);
  /** نوافذ أنهاها الزائر في هذه الجلسة (ليختفي الإشعار فورًا دون انتظار إعادة القراءة). */
  const [hidden, setHidden] = useState<string[]>([]);
  /** تأجيلات هذه الجلسة (احتياط إن تعذّر التخزين المحلي). */
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [reading, setReading] = useState<AdhkarWindow | null>(null);

  useEffect(() => {
    if (!ak.enabled) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [ak.enabled]);

  // موقع الجهاز المحفوظ (تطلبه نافذة الأذان بإذن الزائر؛ هنا لا نطلب إذنًا جديدًا).
  const minute = Math.floor(now / 60_000);
  useEffect(() => {
    if (ak.enabled) setAuto(readSavedPos());
  }, [ak.enabled, minute, prefs]);

  const coords = effectiveCoords(cfg, auto);
  const slots = useMemo(
    () => (ak.enabled ? slotsAround(new Date(now), coords.lat, coords.lng, cfg) : []),
    // المواقيت لا تتغير بين الدقائق.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ak.enabled, cfg, coords.lat, coords.lng, minute],
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
