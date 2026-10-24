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

export type City = { id: string; name: string; lat: number; lng: number };
export const CITIES: readonly City[] = [
  { id: "faqous", name: "فاقوس (الشرقية)", lat: 30.7236, lng: 31.7969 },
  { id: "zagazig", name: "الزقازيق", lat: 30.5877, lng: 31.502 },
  { id: "cairo", name: "القاهرة", lat: 30.0444, lng: 31.2357 },
  { id: "alex", name: "الإسكندرية", lat: 31.2001, lng: 29.9187 },
  { id: "mansoura", name: "المنصورة", lat: 31.0409, lng: 31.3785 },
  { id: "aswan", name: "أسوان", lat: 24.0889, lng: 32.8998 },
  { id: "makkah", name: "مكة المكرمة", lat: 21.3891, lng: 39.8579 },
  { id: "madinah", name: "المدينة المنورة", lat: 24.4686, lng: 39.6142 },
  { id: "riyadh", name: "الرياض", lat: 24.7136, lng: 46.6753 },
  { id: "dubai", name: "دبي", lat: 25.2048, lng: 55.2708 },
  { id: "kuwait", name: "الكويت", lat: 29.3759, lng: 47.9774 },
  { id: "amman", name: "عمّان", lat: 31.9454, lng: 35.9284 },
  { id: "baghdad", name: "بغداد", lat: 33.3152, lng: 44.3661 },
  { id: "casablanca", name: "الدار البيضاء", lat: 33.5731, lng: -7.5898 },
  { id: "tunis", name: "تونس", lat: 36.8065, lng: 10.1815 },
  { id: "khartoum", name: "الخرطوم", lat: 15.5007, lng: 32.5599 },
];

export type LocationMode = "city" | "custom" | "auto";

export type AdhanSettings = {
  enabled: boolean;
  /** city = مدينة من القائمة، custom = إحداثيات يدوية، auto = موقع جهاز الزائر (يطلب إذنه) وإن رفض نستعمل المدينة. */
  locationMode: LocationMode;
  cityId: string;
  lat: number;
  lng: number;
  method: MethodId;
  asr: AsrMode;
  /** الصلوات التي تظهر لها النافذة. */
  prayers: Record<PrayerId, boolean>;
  /** تقديم/تأخير كل صلاة بالدقائق (−30…+30). */
  adjust: Record<PrayerId, number>;
  /** رابط ملف صوت التكبيرات (mp3) أو مساره داخل الموقع مثل /audio/takbeer.mp3. فارغ = بلا صوت. */
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
};

export const DEFAULT_ADHAN: AdhanSettings = {
  enabled: true,
  locationMode: "auto",
  cityId: "faqous",
  lat: 30.7236,
  lng: 31.7969,
  method: "egypt",
  asr: "standard",
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  adjust: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  audioUrl: "",
  volume: 80,
  countdownMin: 10,
  text: "حان الآن موعد أذان {prayer} — حيّ على الصلاة",
  imageUrl: "",
  closable: true,
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

export function cleanAdhan(v: unknown): AdhanSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const D = DEFAULT_ADHAN;
  const num = (x: unknown, lo: number, hi: number, fb: number) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
  };
  const rec = (x: unknown) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});
  const pr = rec(o.prayers), ad = rec(o.adjust);
  const prayers = { ...D.prayers };
  const adjust = { ...D.adjust };
  for (const p of PRAYERS) {
    prayers[p.id] = pr[p.id] !== false;
    adjust[p.id] = Math.round(num(ad[p.id], -30, 30, 0));
  }
  const text = typeof o.text === "string" && o.text.trim() ? o.text.trim().slice(0, 120) : D.text;
  return {
    enabled: o.enabled !== false,
    locationMode: o.locationMode === "custom" || o.locationMode === "city" ? o.locationMode : "auto",
    cityId: CITIES.some((c) => c.id === o.cityId) ? (o.cityId as string) : D.cityId,
    lat: num(o.lat, -66, 66, D.lat),
    lng: num(o.lng, -180, 180, D.lng),
    method: METHODS.some((m) => m.id === o.method) ? (o.method as MethodId) : D.method,
    asr: o.asr === "hanafi" ? "hanafi" : "standard",
    prayers,
    adjust,
    audioUrl: cleanMediaUrl(o.audioUrl),
    volume: Math.round(num(o.volume, 0, 100, D.volume)),
    countdownMin: Math.round(num(o.countdownMin, 1, 60, D.countdownMin)),
    text,
    imageUrl: cleanMediaUrl(o.imageUrl),
    closable: o.closable !== false,
  };
}

/** الإحداثيات المعتمدة من الإعدادات (دون الموقع التلقائي). */
export function configuredCoords(a: AdhanSettings): { lat: number; lng: number } {
  if (a.locationMode === "custom") return { lat: a.lat, lng: a.lng };
  const c = CITIES.find((x) => x.id === a.cityId) ?? CITIES[0];
  return { lat: c.lat, lng: c.lng };
}
