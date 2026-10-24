// البث المباشر المبني من فيديوهات القناة: قائمة مرتّبة تُعرض بتسلسل زمني مشترك بين كل المشاهدين.
// تُحفظ في Firestore: live/current

export type LiveItem = {
  videoId: string;
  title: string;
  driveId: string;
  thumbnail: string;
  /** بالثواني؛ 0 = غير معروفة. */
  duration: number;
};

export type LiveDoc = {
  title: string;
  items: LiveItem[];
  loop: boolean;
  active: boolean;
  /** لحظة بدء البث (ms) أو null. قد تكون في المستقبل: عندها يظهر للزوار «سيبدأ البث…» حتى يحين الموعد. */
  startedAt: number | null;
  /** بث يوم الأسبوع فقط: ساعة بدء البث كل يوم بصيغة «HH:mm» (بتوقيت إعداد المنطقة الزمنية). فارغ = يبدأ من لحظة الضغط على «بدء البث». */
  startTime: string;
};

export const EMPTY_LIVE: LiveDoc = { title: "", items: [], loop: true, active: false, startedAt: null, startTime: "" };
export const START_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const LIVE_MAX_ITEMS = 100;

export function parseLive(d: Record<string, unknown> | undefined): LiveDoc {
  if (!d) return EMPTY_LIVE;
  const items = Array.isArray(d.items)
    ? (d.items as unknown[])
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
          const dur = Number(o.duration);
          return {
            videoId: s("videoId"),
            title: s("title"),
            driveId: s("driveId"),
            thumbnail: s("thumbnail"),
            duration: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 0,
          };
        })
        .filter((i) => i.videoId && i.driveId)
        .slice(0, LIVE_MAX_ITEMS)
    : [];
  const t = d.startedAt as { toMillis?: () => number } | null | undefined;
  return {
    title: typeof d.title === "string" ? d.title : "",
    items,
    loop: d.loop !== false,
    active: d.active === true,
    startedAt: t && typeof t.toMillis === "function" ? t.toMillis() : null,
    startTime: typeof d.startTime === "string" && START_TIME_RE.test(d.startTime) ? d.startTime : "",
  };
}

export function totalSeconds(items: readonly LiveItem[]): number {
  return items.reduce((n, i) => n + i.duration, 0);
}

export type NowPlaying =
  | { state: "playing"; index: number; offset: number; remaining: number }
  | { state: "waiting"; /** ثوانٍ حتى بدء البث. */ startsIn: number }
  | { state: "ended" }
  | { state: "invalid" };

/** أي عنصر يُعرض الآن وكم مضى منه؟ (كل المشاهدين يحصلون على النتيجة نفسها لأنها تعتمد على وقت البدء). */
export function nowPlaying(items: readonly LiveItem[], startedAt: number, now: number, loop: boolean): NowPlaying {
  const total = totalSeconds(items);
  if (items.length === 0 || total <= 0 || items.some((i) => i.duration <= 0)) return { state: "invalid" };
  if (now < startedAt) return { state: "waiting", startsIn: Math.ceil((startedAt - now) / 1000) };
  let t = Math.max(0, (now - startedAt) / 1000);
  if (t >= total) {
    if (!loop) return { state: "ended" };
    t = t % total;
  }
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    if (t < acc + items[i].duration) return { state: "playing", index: i, offset: t - acc, remaining: acc + items[i].duration - t };
    acc += items[i].duration;
  }
  return { state: "ended" };
}

/** ثوانٍ → «h:mm:ss» دائمًا (للإجمالي). */
export function formatTotal(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${r}`;
}

// ---------- الجدولة: بث عام أو بث لكل يوم من أيام الأسبوع ----------
// المستندات في Firestore (كلها تحت live/ وقواعدها الحالية تكفي):
//   live/current  → البث العام (يُستعمل كل يوم في وضع «عام»، وكاحتياط في وضع «أيام الأسبوع»)
//   live/day0 … live/day6 → بث كل يوم (0 = الأحد … 6 = السبت، كما في JavaScript)
//   live/config   → { mode, fallback, tz }

/** أسماء الأيام بحسب رقم اليوم في JavaScript (0 = الأحد). */
export const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;
/** ترتيب العرض: الأسبوع يبدأ بالسبت. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

export type LiveMode = "general" | "weekly";

/** نصوص صفحة البث التي يعدّلها المشرف. القوالب تقبل متغيرات بين أقواس مثل {day} و{time} (انظر LIVE_TEXT_FIELDS). */
export type LiveTexts = {
  badge: string;
  scheduleHeading: string;
  metaNow: string;
  metaNext: string;
  waiting: string;
  noLive: string;
  noLiveToday: string;
  nextDay: string;
  nextUnknown: string;
  ended: string;
};

export const DEFAULT_LIVE_TEXTS: LiveTexts = {
  badge: "بث مباشر",
  scheduleHeading: "جدول البث",
  metaNow: "مضى {elapsed} من {duration} • المقطع {n} من {count}",
  metaNext: " • التالي: {next} بعد {remaining}",
  waiting: "سيبدأ البث {time}، بعد {countdown}.",
  noLive: "لا يوجد بث مباشر حاليًا.",
  noLiveToday: "لا يوجد بث مباشر اليوم.",
  nextDay: "البث القادم يوم {day}.",
  nextUnknown: "تابعنا لمعرفة موعد البث القادم.",
  ended: "انتهى البث. تابعنا لمعرفة موعد البث القادم.",
};

export const LIVE_TEXT_FIELDS: { key: keyof LiveTexts; label: string; vars: string[]; max: number; hint?: string }[] = [
  { key: "badge", label: "شارة البث (بجانب النقطة الحمراء)", vars: [], max: 40 },
  { key: "scheduleHeading", label: "عنوان قائمة الجدول (يليه إجمالي الوقت)", vars: [], max: 40 },
  { key: "metaNow", label: "سطر التقدّم تحت اسم المقطع", vars: ["elapsed", "duration", "n", "count"], max: 160 },
  { key: "metaNext", label: "تتمة السطر عند وجود مقطع تالٍ", vars: ["next", "remaining"], max: 160, hint: "تُلصق بعد السطر السابق؛ اتركها كما هي أو غيّر الصياغة." },
  { key: "waiting", label: "رسالة الانتظار قبل موعد بدء البث", vars: ["time", "countdown"], max: 200 },
  { key: "noLive", label: "لا يوجد بث (النمط العام)", vars: [], max: 160 },
  { key: "noLiveToday", label: "لا يوجد بث اليوم (نمط أيام الأسبوع)", vars: [], max: 160 },
  { key: "nextDay", label: "أقرب يوم له بث (نمط أيام الأسبوع)", vars: ["day"], max: 160 },
  { key: "nextUnknown", label: "عند عدم وجود موعد قادم", vars: [], max: 160 },
  { key: "ended", label: "رسالة انتهاء البث", vars: [], max: 200 },
];

export function cleanLiveTexts(v: unknown): LiveTexts {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_LIVE_TEXTS };
  for (const f of LIVE_TEXT_FIELDS) {
    const x = o[f.key];
    // نسمح بنص يبدأ بمسافة (مثل metaNext)؛ النص الفارغ تمامًا يعني «الافتراضي».
    if (typeof x === "string" && x.trim()) out[f.key] = x.slice(0, f.max);
  }
  return out;
}

/** يستبدل {name} في القالب بقيمه؛ المتغير المجهول يبقى كما كُتب. */
export function fillTemplate(t: string, vars: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export type LiveConfig = {
  mode: LiveMode;
  /** في وضع الأيام: إن لم يكن لليوم بث فعّال يُعرض البث العام. */
  fallback: boolean;
  /** المنطقة الزمنية التي يُحسب بها «اليوم» وساعة البدء (فارغ = توقيت جهاز الزائر). */
  tz: string;
  texts: LiveTexts;
};
export const DEFAULT_LIVE_CONFIG: LiveConfig = { mode: "general", fallback: true, tz: "", texts: DEFAULT_LIVE_TEXTS };

export type LiveStreams = { current: LiveDoc; days: LiveDoc[]; config: LiveConfig };
export const EMPTY_STREAMS: LiveStreams = { current: EMPTY_LIVE, days: Array.from({ length: 7 }, () => EMPTY_LIVE), config: DEFAULT_LIVE_CONFIG };

/** معرّف مستند البث: «current» أو «day0…day6». */
export const liveDocId = (day: number | "current"): string => (day === "current" ? "current" : `day${day}`);

const tzOk = new Map<string, boolean>();
function validTz(tz: string): boolean {
  if (!tz) return false;
  const known = tzOk.get(tz);
  if (known !== undefined) return known;
  let ok = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    ok = false;
  }
  tzOk.set(tz, ok);
  return ok;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
/** تاريخ ووقت لحظة ما بتوقيت منطقة (أو بتوقيت الجهاز إن لم تُحدَّد). */
function zonedParts(ms: number, tz: string): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  if (!validTz(tz)) {
    const x = new Date(ms);
    return { y: x.getFullYear(), m: x.getMonth() + 1, d: x.getDate(), h: x.getHours(), mi: x.getMinutes(), s: x.getSeconds() };
  }
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    fmtCache.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(ms)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

/** يحوّل تاريخًا وساعة بتوقيت المنطقة إلى لحظة مطلقة (ms). بلا منطقة صالحة: بتوقيت الجهاز. */
export function zonedToMs(y: number, m: number, d: number, h: number, mi: number, tz: string): number {
  if (!validTz(tz)) return new Date(y, m - 1, d, h, mi).getTime();
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const off = (t: number) => {
    const z = zonedParts(t, tz);
    return Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi, z.s) - Math.floor(t / 1000) * 1000;
  };
  let t = wall - off(wall);
  t = wall - off(t); // تصحيح ثانٍ لحالة تغيّر التوقيت الصيفي
  return t;
}

/** «2026-10-24T20:30» (من حقل datetime-local) → لحظة مطلقة بتوقيت المنطقة؛ NaN إن كان غير صالح. */
export function parseLocalInput(v: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return NaN;
  return zonedToMs(+m[1], +m[2], +m[3], +m[4], +m[5], tz);
}

/** لحظة مطلقة → «YYYY-MM-DDTHH:mm» بتوقيت المنطقة (لملء حقل datetime-local). */
export function toLocalInput(ms: number, tz: string): string {
  const z = zonedParts(ms, tz);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(z.y, 4)}-${p(z.m)}-${p(z.d)}T${p(z.h)}:${p(z.mi)}`;
}

/** لحظة بدء «اليوم» الحالي عند الساعة HH:mm بتوقيت المنطقة. */
export function todayAt(now: number, tz: string, hhmm: string): number {
  const z = zonedParts(now, tz);
  const [h, mi] = hhmm.split(":").map(Number);
  return zonedToMs(z.y, z.m, z.d, h, mi, tz);
}

/** عرض موعد البدء للزائر: «اليوم الساعة ٨:٣٠ م» أو «يوم الجمعة ٢٥/١٠ الساعة ٨:٣٠ م». */
export function describeStart(at: number, now: number, tz: string): string {
  const zone = validTz(tz) ? tz : undefined;
  const clock = new Intl.DateTimeFormat("ar", { hour: "numeric", minute: "2-digit", timeZone: zone }).format(at);
  const a = zonedParts(at, tz);
  const n = zonedParts(now, tz);
  const dayDiff = Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(n.y, n.m - 1, n.d)) / 86_400_000);
  if (dayDiff === 0) return `اليوم الساعة ${clock}`;
  if (dayDiff === 1) return `غدًا الساعة ${clock}`;
  const date = new Intl.DateTimeFormat("ar", { weekday: "long", day: "numeric", month: "numeric", timeZone: zone }).format(at);
  return `يوم ${date} الساعة ${clock}`;
}

export function parseLiveConfig(d: Record<string, unknown> | undefined): LiveConfig {
  if (!d) return DEFAULT_LIVE_CONFIG;
  const tz = typeof d.tz === "string" && validTz(d.tz) ? d.tz : "";
  return { mode: d.mode === "weekly" ? "weekly" : "general", fallback: d.fallback !== false, tz, texts: cleanLiveTexts(d.texts) };
}

/** يحوّل مستندات مجموعة live إلى بنية واحدة. */
export function parseStreams(docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>): LiveStreams {
  const out: LiveStreams = { current: EMPTY_LIVE, days: Array.from({ length: 7 }, () => EMPTY_LIVE), config: DEFAULT_LIVE_CONFIG };
  for (const { id, data } of docs) {
    if (id === "current") out.current = parseLive(data);
    else if (id === "config") out.config = parseLiveConfig(data);
    else {
      const m = /^day([0-6])$/.exec(id);
      if (m) out.days[Number(m[1])] = parseLive(data);
    }
  }
  return out;
}

/** رقم اليوم (0 = الأحد) في المنطقة الزمنية المحددة، أو بتوقيت الجهاز إن لم تُحدَّد. */
export function dayInTz(now: number, tz: string): number {
  if (validTz(tz)) {
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const w = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(now);
    if (w in map) return map[w];
  }
  return new Date(now).getDay();
}

/** هل البث جارٍ فعلًا (مفعّل وله وقت بدء وقائمة)؟ */
export function isRunning(l: LiveDoc): boolean {
  return l.active && (l.startedAt !== null || l.startTime !== "") && l.items.length > 0;
}

/** لحظة بدء البث الفعلية الآن: ساعة اليوم المحددة (إن وُجدت) وإلا لحظة البدء المحفوظة. */
export function effectiveStart(l: LiveDoc, now: number, tz: string): number | null {
  if (l.startTime) return todayAt(now, tz, l.startTime);
  return l.startedAt;
}

/** هل حان موعد بدء هذا البث؟ */
function isStarted(l: LiveDoc, now: number, tz: string): boolean {
  const at = effectiveStart(l, now, tz);
  return at !== null && now >= at;
}

export type Chosen = { live: LiveDoc; day: number; source: "general" | "day" };

/** أي بث يُعرض الآن؟ (يعتمد على الوضع واليوم الحالي). */
export function pickStream(s: LiveStreams, now: number): Chosen {
  const day = dayInTz(now, s.config.tz);
  if (s.config.mode === "weekly") {
    const d = s.days[day];
    const tz = s.config.tz;
    const general = s.config.fallback && isRunning(s.current) ? s.current : null;
    if (isRunning(d)) {
      // لم يحن موعد بث اليوم بعد: نعرض العام إن كان جاريًا، وإلا رسالة الانتظار.
      if (!isStarted(d, now, tz) && general && isStarted(general, now, tz)) return { live: general, day, source: "general" };
      return { live: d, day, source: "day" };
    }
    if (general) return { live: general, day, source: "general" };
    return { live: d, day, source: "day" };
  }
  return { live: s.current, day, source: "general" };
}

/** أقرب يوم قادم (بعد اليوم المعطى) له بث فعّال، أو null. */
export function nextDayWithStream(s: LiveStreams, day: number): number | null {
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (isRunning(s.days[d])) return d;
  }
  return null;
}
