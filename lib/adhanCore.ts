// إعدادات الأذان (نقية: تعمل في الخادم والمتصفح). حساب المواقيت نفسه في lib/prayer.ts.

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

/** ما يحدث عند الضغط على خيار في «توجيه الوالدين»: continue = تُغلق نافذة الأذان ويتابع الزائر المشاهدة، back = يعود لنافذة الأذان. */
export type ParentAction = "continue" | "back";
export type ParentOption = { id: string; label: string; action: ParentAction };
export const PARENT_OPTIONS_MAX = 8;
export const PARENT_LABEL_MAX = 60;

export const DEFAULT_PARENT_OPTIONS: ParentOption[] = [
  { id: "done", label: "ابني صلى بالفعل", action: "continue" },
  { id: "young", label: "ابني أصغر من (6) سنوات", action: "continue" },
  { id: "back", label: "رجوع للتطبيق", action: "back" },
];

export type AdhanSettings = {
  enabled: boolean;
  /** الصلوات التي تظهر لها النافذة. */
  prayers: Record<PrayerId, boolean>;
  /** تقديم/تأخير كل صلاة بالدقائق (−30…+30). */
  adjust: Record<PrayerId, number>;
  /** رابط ملف صوت التكبيرات (mp3) أو مساره داخل الموقع مثل /audio/takbeer.mp3. فارغ = بلا صوت. الافتراضي: /audio/takbeer.mp3. */
  audioUrl: string;
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
  /** خيارات نافذة «توجيه الوالدين» (قائمة فارغة = يُخفى زر «توجيه الوالدين»). */
  parentOptions: ParentOption[];
};

export const DEFAULT_ADHAN: AdhanSettings = {
  enabled: true,
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  adjust: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  audioUrl: "/audio/takbeer.mp3", // الافتراضي: يبدأ التكبير فور ظهور النافذة (الملف ضمن public/audio)
  volume: 80,
  countdownMin: 10,
  text: "حان الآن موعد أذان {prayer} — حيّ على الصلاة",
  imageUrl: "",
  closable: true,
  remind: true,
  remindMin: { fajr: 5, dhuhr: 5, asr: 5, maghrib: 5, isha: 5 },
  remindText: "اقتربت صلاة {prayer} — بعد {min} دقيقة",
  adminShow: false,
  parentOptions: DEFAULT_PARENT_OPTIONS,
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

/** مصادر صوت الأذان: الصوت العام (رابط مباشر أو مسار داخل الموقع) إن وُجد. روابط درايف غير مدعومة. */
export function audioSources(cfg: Pick<AdhanSettings, "audioUrl">, _prayer?: PrayerId): string[] {
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
  const pr = rec(o.prayers), rm = rec(o.remindMin);
  const prayers = { ...D.prayers };
  const adjust = { ...D.adjust };
  const remindMin = { ...D.remindMin };
  for (const p of PRAYERS) {
    prayers[p.id] = pr[p.id] !== false;
    adjust[p.id] = 0; // لا تعديل يدوي للمواقيت: تُحسب من الموقع فقط
    remindMin[p.id] = Math.round(num(rm[p.id], 0, 60, D.remindMin[p.id]));
  }
  // غياب الحقل (إعدادات قديمة) = الخيارات الافتراضية؛ وجوده قائمةً فارغة = لا خيارات (يُخفى الزر).
  let parentOptions: ParentOption[] = DEFAULT_PARENT_OPTIONS.map((x) => ({ ...x }));
  if (Array.isArray(o.parentOptions)) {
    parentOptions = [];
    const ids = new Set<string>();
    for (const x of o.parentOptions.slice(0, PARENT_OPTIONS_MAX)) {
      const r = rec(x);
      const label = typeof r.label === "string" ? r.label.trim().replace(/\s+/g, " ").slice(0, PARENT_LABEL_MAX) : "";
      if (!label) continue;
      let id = typeof r.id === "string" ? r.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20) : "";
      if (!id || ids.has(id)) id = `o${parentOptions.length + 1}_${ids.size}`;
      ids.add(id);
      parentOptions.push({ id, label, action: r.action === "back" ? "back" : "continue" });
    }
  }
  const text = typeof o.text === "string" && o.text.trim() ? o.text.trim().slice(0, 120) : D.text;
  const remindText = typeof o.remindText === "string" && o.remindText.trim() ? o.remindText.trim().slice(0, 120) : D.remindText;
  return {
    enabled: o.enabled !== false,
    prayers,
    adjust,
    // غياب الحقل (إعدادات قديمة) أو رابط درايف قديم (لم يعد مدعومًا) = الصوت الافتراضي؛ وجوده فارغًا = بلا صوت عمدًا.
    audioUrl: o.audioUrl === undefined || /(drive|docs)\.google\.com|drive\.usercontent\.google\.com/.test(String(o.audioUrl)) ? D.audioUrl : cleanMediaUrl(o.audioUrl),
    volume: Math.round(num(o.volume, 0, 100, D.volume)),
    countdownMin: Math.round(num(o.countdownMin, 1, 60, D.countdownMin)),
    text,
    imageUrl: cleanMediaUrl(o.imageUrl),
    closable: o.closable !== false,
    remind: o.remind !== false,
    remindMin,
    remindText,
    adminShow: o.adminShow === true,
    parentOptions,
  };
}
