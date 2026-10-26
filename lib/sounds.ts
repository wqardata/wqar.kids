"use client";
// أصوات التنبيه: نغمات قصيرة تُولَّد بـ Web Audio (بلا ملفات). المتصفحات تمنع الصوت قبل أن يتفاعل الزائر مع الصفحة،
// لذلك نفتح السياق عند أول نقرة/لمسة/مفتاح؛ وقبلها يُتجاهل التنبيه بصمت.

export type AlertKind = "notify" | "remind" | "adhan";

type Note = { f: number; at: number; len: number };
const TONES: Record<AlertKind, Note[]> = {
  // إشعار جديد: نغمتان قصيرتان صاعدتان.
  notify: [{ f: 880, at: 0, len: 0.14 }, { f: 1175, at: 0.15, len: 0.22 }],
  // اقتراب الصلاة: ثلاث نغمات هادئة.
  remind: [{ f: 523, at: 0, len: 0.25 }, { f: 659, at: 0.28, len: 0.25 }, { f: 784, at: 0.56, len: 0.4 }],
  // الأذان: نغمات أطول وأعمق تتكرر مرتين.
  adhan: [
    { f: 392, at: 0, len: 0.35 }, { f: 494, at: 0.4, len: 0.35 }, { f: 587, at: 0.8, len: 0.6 },
    { f: 392, at: 1.7, len: 0.35 }, { f: 494, at: 2.1, len: 0.35 }, { f: 587, at: 2.5, len: 0.8 },
  ],
};

// دالة منفصلة كي لا يضيّق TypeScript نوع state بعد أول فحص (الحالة تتغير فعليًا بعد resume).
const isRunning = (c: AudioContext): boolean => c.state === "running";

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

let pending: { kind: AlertKind; volume: number; at: number } | null = null;
let armed = false;

/**
 * يفتح الصوت عند تفاعل الزائر مع الصفحة. المستمعون دائمون: بعد عودة التطبيق من الخلفية يعلّق المتصفح السياق
 * (suspended/interrupted) فنحتاج إعادة فتحه عند اللمسة التالية، ثم نشغّل التنبيه الذي فاتنا (إن وُجد).
 */
export function armSounds(): void {
  if (typeof window === "undefined" || armed) return;
  armed = true;
  const unlock = () => {
    const c = getCtx();
    if (!c) return;
    if (isRunning(c)) {
      flushPending();
      return;
    }
    void c.resume().then(flushPending).catch(() => {});
  };
  ["pointerdown", "keydown", "touchstart", "click"].forEach((e) => window.addEventListener(e, unlock, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlock();
  });
}

function flushPending() {
  const p = pending;
  pending = null;
  // تنبيه فات أثناء الغياب: نشغّله الآن فقط إن كان حديثًا (لا معنى لنغمة قديمة).
  if (p && Date.now() - p.at < 120_000) playNow(p.kind, p.volume);
}

/** يشغّل نغمة التنبيه. `volume` من 0 إلى 100. يعيد false إن لم يكن الصوت مفتوحًا بعد (تُحفظ النغمة وتُشغَّل عند أول لمسة). */
export function playAlert(kind: AlertKind, volume: number): boolean {
  const c = getCtx();
  if (!c || volume <= 0) return false;
  try { navigator.vibrate?.([120, 60, 120]); } catch { /* غير مدعوم */ }
  if (isRunning(c)) return playNow(kind, volume);
  // السياق معلّق: نحاول فتحه (ينجح إن كان للصفحة تفاعل سابق)، وإلا نؤجل النغمة إلى أول لمسة.
  pending = { kind, volume, at: Date.now() };
  void c.resume().then(() => {
    if (isRunning(c)) flushPending();
  }).catch(() => {});
  return false;
}

function playNow(kind: AlertKind, volume: number): boolean {
  const c = getCtx();
  if (!c || !isRunning(c)) return false;
  const peak = 0.5 * Math.min(1, Math.max(0, volume / 100));
  const t0 = c.currentTime + 0.02;
  for (const n of TONES[kind]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = n.f;
    const s = t0 + n.at;
    gain.gain.setValueAtTime(0.0001, s);
    gain.gain.exponentialRampToValueAtTime(peak, s + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, s + n.len);
    osc.connect(gain).connect(c.destination);
    osc.start(s);
    osc.stop(s + n.len + 0.05);
  }
  return true;
}
