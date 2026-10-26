// إعدادات الأذان (نقية: تعمل في الخادم والمتصفح). حساب المواقيت نفسه في lib/prayer.ts.
import { DRIVE_ID, parseDriveId } from "./drive";

export const PRAYERS = [
  { id: "fajr", label: "الفجر" },
  { id: "dhuhr", label: "الظهر" },
  { id: "asr", label: "العصر" },
  { id: "maghrib", label: "المغرب" },
  { id: "isha", label: "العشاء" },
] as const;
export type PrayerId = (typeof PRAYERS)[number]["id"];

/** طرق الحساب: زاويتا الفجر والعشاء، أو دقائق ثابتة بعد المغرب للعشاء. */
export const METHODS = [
  { id: "egypt", label: "الهيئة المصرية العامة للمساحة", fajr: 19.5, isha: 17.5, ishaMin: 0 },
  { id: "mwl", label: "رابطة العالم الإسلامي", fajr: 18, isha: 17, ishaMin: 0 },
  { id: "makkah", label: "أم القرى (مكة المكرمة)", fajr: 18.5, isha: 0, ishaMin: 90 },
  { id: "karachi", label: "جامعة العلوم الإسلامية (كراتشي)", fajr: 18, isha: 18, ishaMin: 0 },
  { id: "isna", label: "أمريكا الشمالية (ISNA)", fajr: 15, isha: 15, ishaMin: 0 },
  { id: "kuwait", label: "الكويت", fajr: 18, isha: 17.5, ishaMin: 0 },
  { id: "qatar", label: "قطر", fajr: 18, isha: 0, ishaMin: 90 },
] as const;
export type MethodId = (typeof METHODS)[number]["id"];

export const ASR_MODES = [
  { id: "standard", label: "الجمهور (الشافعي والمالكي والحنبلي)" },
  { id: "hanafi", label: "الحنفي" },
] as const;
export type AsrMode = (typeof ASR_MODES)[number]["id"];

/** إحداثيات احتياطية لا تُستعمل إلا إن تعذّر كل شيء (لا موقع جهاز ولا تقدير من المنطقة الزمنية): القاهرة. */
export const FALLBACK_COORDS = { lat: 30.0444, lng: 31.2357 } as const;

/** طريقة الحساب المختارة تلقائيًا لموقع معيّن. */
export type Calc = { method: MethodId; asr: AsrMode };

// [خط العرض الأدنى، الأعلى، خط الطول الأدنى، الأعلى]. صناديق تقريبية (لا حدود دول دقيقة)، والأول المطابق يفوز.
type Box = readonly [number, number, number, number];
const REGIONS: readonly { box: Box; calc: Calc }[] = [
  { box: [28.5, 30.2, 46.5, 48.6], calc: { method: "kuwait", asr: "standard" } }, // الكويت
  { box: [24.4, 26.2, 50.7, 51.7], calc: { method: "qatar", asr: "standard" } }, // قطر
  { box: [16, 32.2, 36.2, 43], calc: { method: "makkah", asr: "standard" } }, // غرب الجزيرة العربية وشمالها
  { box: [16, 30, 43, 60], calc: { method: "makkah", asr: "standard" } }, // شرق الجزيرة العربية (السعودية، الإمارات، البحرين، عُمان)
  { box: [12, 16, 42.5, 54], calc: { method: "makkah", asr: "standard" } }, // اليمن
  { box: [-35, 37.5, 11.5, 48], calc: { method: "egypt", asr: "standard" } }, // مصر والسودان وليبيا والشام والعراق وشرق إفريقيا
  { box: [5, 38, 61, 93], calc: { method: "karachi", asr: "hanafi" } }, // أفغانستان وباكستان والهند وبنغلاديش
  { box: [-11, 8, 95, 141], calc: { method: "egypt", asr: "standard" } }, // ماليزيا وإندونيسيا وسنغافورة
  { box: [-60, 75, -170, -30], calc: { method: "isna", asr: "standard" } }, // الأمريكتان
];

/**
 * يختار جهة حساب الصلوات ومذهب العصر تلقائيًا من الإحداثيات (بلا أي إعداد يدوي).
 * خارج هذه المناطق (أوروبا وتركيا والمغرب العربي وغرب إفريقيا وآسيا الوسطى وشرق آسيا…) تُستعمل «رابطة العالم الإسلامي».
 * الفروق بين الجهات بضع دقائق في الفجر والعشاء فقط، والمواقيت تقريبية؛ قارنها بتقويم مسجدك المحلي.
 */
export function autoCalc(lat: number, lng: number): Calc {
  for (const r of REGIONS) {
    const [a, b, c, d] = r.box;
    if (lat >= a && lat <= b && lng >= c && lng <= d) return r.calc;
  }
  return { method: "mwl", asr: "standard" };
}

export type AdhanSettings = {
  enabled: boolean;
  /** الصلوات التي تظهر لها النافذة. */
  prayers: Record<PrayerId, boolean>;
  /** تقديم/تأخير كل صلاة بالدقائق (−30…+30). */
  adjust: Record<PrayerId, number>;
  /** رابط ملف صوت التكبيرات (mp3) أو مساره داخل الموقع مثل /audio/takbeer.mp3. فارغ = بلا صوت. */
  audioUrl: string;
  /**
   * صوت خاص لكل صلاة: حتى PRAYER_AUDIO_MAX نسخ لكل صلاة (معرّف ملف درايف، أو رابط/مسار). يُختار أحدها عشوائيًا عند كل أذان،
   * وإن فشل (مثل تجاوز حد تنزيل درايف) يُجرَّب التالي. الصلاة التي لا نسخة لها تستعمل audioUrl العام.
   * أثناء التحرير في اللوحة قد تحوي القيمة الرابط الخام.
   */
  prayerAudio: Record<PrayerId, string[]>;
  volume: number; // 0..100
  /** مدة العدّ التنازلي بالدقائق (عادةً الوقت بين الأذان والإقامة). */
  countdownMin: number;
  /** النص بين الصورة والعداد. {prayer} يُستبدل باسم الصلاة. */
  text: string;
  /** صورة مسجد مخصّصة (رابط). فارغ = رسم المسجد الكرتوني المدمج. */
  imageUrl: string;
  /** إظهار زر إغلاق للزائر. */
  closable: boolean;
  /** تنبيه قبل الأذان: فقاعة زجاجية تظهر قبل موعد كل صلاة بعدد الدقائق المحدَّد لها. */
  remind: boolean;
  /** دقائق التنبيه لكل صلاة (0 = بلا تنبيه لتلك الصلاة). */
  remindMin: Record<PrayerId, number>;
  /** نص التنبيه. {prayer} اسم الصلاة، {min} الدقائق المتبقية. */
  remindText: string;
  /** إظهار نافذة الأذان وتنبيه «اقتربت صلاة» للمشرفين أيضًا. الافتراضي: معطّل (لا تقاطع المشرف أثناء عمله في لوحة التحكم). */
  adminShow: boolean;
};

export const DEFAULT_ADHAN: AdhanSettings = {
  enabled: true,
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  adjust: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  audioUrl: "",
  prayerAudio: { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [] },
  volume: 80,
  countdownMin: 10,
  text: "حان الآن موعد أذان {prayer} — حيّ على الصلاة",
  imageUrl: "",
  closable: true,
  remind: true,
  remindMin: { fajr: 5, dhuhr: 5, asr: 5, maghrib: 5, isha: 5 },
  remindText: "اقتربت صلاة {prayer} — بعد {min} دقيقة",
  adminShow: false,
};

/** يقبل http/https أو مسارًا داخل الموقع يبدأ بـ / (لا //). */
export function cleanMediaUrl(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.trim();
  if (!t || t.length > 400) return "";
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export const PRAYER_AUDIO_MAX = 3;

/** رابط درايف أو معرّفه ← المعرّف؛ رابط http(s) أو مسار داخلي ← كما هو؛ غير ذلك "". */
export function cleanAudioSrc(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.trim().slice(0, 400);
  if (!t) return "";
  if (/(drive|docs)\.google\.com|drive\.usercontent\.google\.com/.test(t) || DRIVE_ID.test(t)) return parseDriveId(t) ?? "";
  return cleanMediaUrl(t);
}

/** مصادر صوت صلاة معيّنة: نسخها الخاصة إن وُجدت، وإلا الصوت العام. */
export function audioSources(cfg: Pick<AdhanSettings, "audioUrl" | "prayerAudio">, prayer: PrayerId): string[] {
  const own = (cfg.prayerAudio?.[prayer] ?? []).filter(Boolean);
  if (own.length) return own;
  return cfg.audioUrl ? [cfg.audioUrl] : [];
}

export function cleanAdhan(v: unknown): AdhanSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const D = DEFAULT_ADHAN;
  const num = (x: unknown, lo: number, hi: number, fb: number) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
  };
  const rec = (x: unknown) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});
  const pr = rec(o.prayers), rm = rec(o.remindMin), pa = rec(o.prayerAudio);
  const prayers = { ...D.prayers };
  const adjust = { ...D.adjust };
  const remindMin = { ...D.remindMin };
  const prayerAudio: Record<PrayerId, string[]> = { fajr: [], dhuhr: [], asr: [], maghrib: [], isha: [] };
  for (const p of PRAYERS) {
    const list = Array.isArray(pa[p.id]) ? (pa[p.id] as unknown[]) : [];
    const seen = new Set<string>();
    for (const x of list.slice(0, PRAYER_AUDIO_MAX)) {
      const c = cleanAudioSrc(x);
      if (c && !seen.has(c)) { seen.add(c); prayerAudio[p.id].push(c); }
    }
    prayers[p.id] = pr[p.id] !== false;
    adjust[p.id] = 0; // لا تعديل يدوي للمواقيت: تُحسب من الموقع فقط
    remindMin[p.id] = Math.round(num(rm[p.id], 0, 60, D.remindMin[p.id]));
  }
  const text = typeof o.text === "string" && o.text.trim() ? o.text.trim().slice(0, 120) : D.text;
  const remindText = typeof o.remindText === "string" && o.remindText.trim() ? o.remindText.trim().slice(0, 120) : D.remindText;
  return {
    enabled: o.enabled !== false,
    prayers,
    adjust,
    audioUrl: cleanMediaUrl(o.audioUrl),
    prayerAudio,
    volume: Math.round(num(o.volume, 0, 100, D.volume)),
    countdownMin: Math.round(num(o.countdownMin, 1, 60, D.countdownMin)),
    text,
    imageUrl: cleanMediaUrl(o.imageUrl),
    closable: o.closable !== false,
    remind: o.remind !== false,
    remindMin,
    remindText,
    adminShow: o.adminShow === true,
  };
}
