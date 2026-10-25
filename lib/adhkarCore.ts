// إعدادات الأذكار (نقية: تعمل في الخادم والمتصفح). حساب المواقيت نفسه في lib/prayer.ts.
import { PRAYERS, type PrayerId } from "./adhanCore";
import type { Slot } from "./prayer";

export type AdhkarKind = "morning" | "evening";

export const ADHKAR_KINDS: { id: AdhkarKind; label: string; icon: string }[] = [
  { id: "morning", label: "أذكار الصباح", icon: "🌅" },
  { id: "evening", label: "أذكار المساء", icon: "🌇" },
];

export type Dhikr = {
  id: string;
  /** نص الذكر. */
  text: string;
  /** عدد مرات التكرار (1 = مرة واحدة). */
  repeat: number;
  /** سطر صغير اختياري تحت الذكر: الفضل أو المصدر. */
  note: string;
};

/** حدّ زمني: صلاة مع إزاحة بالدقائق (سالبة = قبلها)، أو ساعة ثابتة بتوقيت جهاز الزائر. */
export type Boundary = {
  mode: "prayer" | "clock";
  prayer: PrayerId;
  /** −180…+180 دقيقة (للوضع prayer). */
  offsetMin: number;
  /** "HH:MM" (للوضع clock). */
  time: string;
};

export type AdhkarSettings = {
  enabled: boolean;
  morningEnabled: boolean;
  eveningEnabled: boolean;
  /** متى يظهر إشعار كل نوع ومتى يختفي. */
  morningStart: Boundary;
  morningEnd: Boundary;
  eveningStart: Boundary;
  eveningEnd: Boundary;
  /** نص الإشعار المنبثق. */
  morningText: string;
  eveningText: string;
  morning: Dhikr[];
  evening: Dhikr[];
};

export const TEXT_MAX = 1200;
export const NOTE_MAX = 200;
export const REPEAT_MAX = 1000;
export const ITEMS_MAX = 60;

const d = (id: string, text: string, repeat = 1, note = ""): Dhikr => ({ id, text, repeat, note });

const AYAT_KURSI =
  "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ";
const IKHLAS = "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ";
const FALAQ = "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِن شَرِّ مَا خَلَقَ ۝ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ";
const NAS = "قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ";
const SAYYID =
  "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ";
const BISMILLAH = "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ";
const SUBHAN = "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ";

/** أذكار مبدئية معروفة؛ يعدّلها المشرف أو يحذفها أو يضيف غيرها من تبويب «إعدادات الأذكار». */
export const DEFAULT_MORNING: Dhikr[] = [
  d("m-kursi", AYAT_KURSI, 1, "سورة البقرة — آية الكرسي"),
  d("m-ikhlas", IKHLAS, 3, "سورة الإخلاص"),
  d("m-falaq", FALAQ, 3, "سورة الفلق"),
  d("m-nas", NAS, 3, "سورة الناس"),
  d("m-sayyid", SAYYID, 1, "سيد الاستغفار"),
  d("m-bismillah", BISMILLAH, 3),
  d("m-radheetu", "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا", 3),
  d("m-subhan", SUBHAN, 100),
];

export const DEFAULT_EVENING: Dhikr[] = [
  d("e-kursi", AYAT_KURSI, 1, "سورة البقرة — آية الكرسي"),
  d("e-ikhlas", IKHLAS, 3, "سورة الإخلاص"),
  d("e-falaq", FALAQ, 3, "سورة الفلق"),
  d("e-nas", NAS, 3, "سورة الناس"),
  d("e-sayyid", SAYYID, 1, "سيد الاستغفار"),
  d("e-bismillah", BISMILLAH, 3),
  d("e-aoodhu", "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ", 3),
  d("e-subhan", SUBHAN, 100),
];

export const DEFAULT_ADHKAR: AdhkarSettings = {
  enabled: true,
  morningEnabled: true,
  eveningEnabled: true,
  morningStart: { mode: "prayer", prayer: "fajr", offsetMin: 0, time: "05:00" },
  morningEnd: { mode: "clock", prayer: "dhuhr", offsetMin: 0, time: "10:00" },
  eveningStart: { mode: "prayer", prayer: "asr", offsetMin: 0, time: "16:00" },
  eveningEnd: { mode: "prayer", prayer: "maghrib", offsetMin: 0, time: "18:00" },
  morningText: "حان وقت أذكار الصباح — هل قلتها؟",
  eveningText: "حان وقت أذكار المساء — هل قلتها؟",
  morning: DEFAULT_MORNING,
  evening: DEFAULT_EVENING,
};

export function newDhikrId(): string {
  return `d-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function cleanItems(v: unknown, fallback: Dhikr[]): Dhikr[] {
  if (!Array.isArray(v)) return fallback;
  const out: Dhikr[] = [];
  const seen = new Set<string>();
  for (const raw of v.slice(0, ITEMS_MAX)) {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim().slice(0, TEXT_MAX) : "";
    if (!text) continue;
    let id = typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 40) : newDhikrId();
    if (seen.has(id)) id = newDhikrId();
    seen.add(id);
    const n = Math.round(Number(o.repeat));
    out.push({
      id,
      text,
      repeat: Number.isFinite(n) ? Math.min(REPEAT_MAX, Math.max(1, n)) : 1,
      note: typeof o.note === "string" ? o.note.trim().slice(0, NOTE_MAX) : "",
    });
  }
  return out;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const OFFSET_MAX = 180;

function cleanBoundary(v: unknown, fb: Boundary): Boundary {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const n = Math.round(Number(o.offsetMin));
  return {
    mode: o.mode === "clock" ? "clock" : o.mode === "prayer" ? "prayer" : fb.mode,
    prayer: PRAYERS.some((p) => p.id === o.prayer) ? (o.prayer as PrayerId) : fb.prayer,
    offsetMin: Number.isFinite(n) ? Math.min(OFFSET_MAX, Math.max(-OFFSET_MAX, n)) : fb.offsetMin,
    time: typeof o.time === "string" && TIME_RE.test(o.time) ? o.time : fb.time,
  };
}

export function cleanAdhkar(v: unknown): AdhkarSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const D = DEFAULT_ADHKAR;
  const txt = (x: unknown, fb: string) => (typeof x === "string" && x.trim() ? x.trim().slice(0, 120) : fb);
  // توافق مع النسخة السابقة التي كانت تحفظ ساعة الانتهاء فقط.
  const oldH = Math.round(Number(o.morningEndHour));
  const morningEndFb: Boundary = Number.isFinite(oldH) && o.morningEnd === undefined
    ? { ...D.morningEnd, time: `${String(Math.min(12, Math.max(6, oldH))).padStart(2, "0")}:00` }
    : D.morningEnd;
  return {
    enabled: o.enabled !== false,
    morningEnabled: o.morningEnabled !== false,
    eveningEnabled: o.eveningEnabled !== false,
    morningStart: cleanBoundary(o.morningStart, D.morningStart),
    morningEnd: cleanBoundary(o.morningEnd, morningEndFb),
    eveningStart: cleanBoundary(o.eveningStart, D.eveningStart),
    eveningEnd: cleanBoundary(o.eveningEnd, D.eveningEnd),
    morningText: txt(o.morningText, D.morningText),
    eveningText: txt(o.eveningText, D.eveningText),
    // إن لم يحفظ المشرف قائمة بعد نستعمل الافتراضية؛ وإن حفظها فارغة تبقى فارغة (لا تظهر النافذة).
    morning: cleanItems(o.morning, D.morning),
    evening: cleanItems(o.evening, D.evening),
  };
}

export type AdhkarWindow = { kind: AdhkarKind; start: number; end: number };

/** يحوّل حدًّا زمنيًا إلى لحظة مطلقة ليوم واحد (daySlots = صلوات ذلك اليوم الخمس مرتبة). */
function resolveBoundary(b: Boundary, daySlots: Slot[]): number | null {
  if (b.mode === "clock") {
    const ref = daySlots.find((x) => x.id === "dhuhr") ?? daySlots[0];
    if (!ref) return null;
    const [h, m] = b.time.split(":").map(Number);
    const t = new Date(ref.at.getTime());
    t.setHours(h, m, 0, 0);
    return t.getTime();
  }
  const s = daySlots.find((x) => x.id === b.prayer);
  return s ? s.at.getTime() + b.offsetMin * 60_000 : null;
}

/** كل نوافذ الأذكار المفعّلة لأيام `slots` (أمس واليوم وغدًا). */
export function adhkarWindows(cfg: AdhkarSettings, slots: Slot[]): AdhkarWindow[] {
  const out: AdhkarWindow[] = [];
  if (!cfg.enabled) return out;
  // slotsAround يعطي خمس صلوات لكل يوم، مرتبة زمنيًا، فكل خمس متتالية = يوم.
  for (let i = 0; i + 5 <= slots.length; i += 5) {
    const day = slots.slice(i, i + 5);
    const defs: [AdhkarKind, boolean, number, Boundary, Boundary][] = [
      ["morning", cfg.morningEnabled, cfg.morning.length, cfg.morningStart, cfg.morningEnd],
      ["evening", cfg.eveningEnabled, cfg.evening.length, cfg.eveningStart, cfg.eveningEnd],
    ];
    for (const [kind, on, n, sb, eb] of defs) {
      if (!on || !n) continue;
      const start = resolveBoundary(sb, day);
      let end = resolveBoundary(eb, day);
      if (start === null || end === null) continue;
      if (end <= start && eb.mode === "clock") end += 86_400_000; // ساعة ثابتة قبل البداية = اليوم التالي
      if (end > start) out.push({ kind, start, end });
    }
  }
  return out;
}

/**
 * نافذة الأذكار الجارية الآن (إن وُجدت). الافتراضي:
 *  - الصباح: من أذان الفجر حتى العاشرة بتوقيت الجهاز.
 *  - المساء: من أذان العصر حتى أذان المغرب.
 * ويضبطهما المشرف من «إعدادات الأذكار».
 */
export function activeAdhkarWindow(cfg: AdhkarSettings, slots: Slot[], now: number): AdhkarWindow | null {
  return adhkarWindows(cfg, slots).find((w) => w.start <= now && now < w.end) ?? null;
}

/** مفتاح «تم» لكل نافذة (يُحفظ في متصفح الزائر). */
export const adhkarDoneKey = (w: AdhkarWindow) => `adhkar-done:${w.kind}:${w.start}`;
export const adhkarSnoozeKey = (w: AdhkarWindow) => `adhkar-snooze:${w.kind}:${w.start}`;
export const SNOOZE_MIN = 30;
