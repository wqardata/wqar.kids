// غيّر اسم الموقع ووصفه من هنا — يُستخدم في العنوان والـ manifest والهيدر.
export const SITE_NAME = "موقعي";
export const SITE_DESCRIPTION = "مشاهدة آمنة بلا إعلانات";

// بيانات الحلقات/المجموعات التجريبية أدناه مخفية افتراضيًا. اجعلها true فقط لتجربة التصميم.
export const SHOW_DEMO_DATA = false;

export type IconName =
  | "home" | "bolt" | "stack" | "live" | "game" | "spark"
  | "heart" | "down" | "gift" | "mail" | "search" | "play" | "user"
  | "like" | "flag" | "up" | "chevdown" | "trash" | "plus" | "close"
  | "star" | "film" | "book" | "music" | "fire" | "globe" | "tv" | "info" | "camera" | "trophy"
  | "gear" | "history" | "check" | "copy" | "eye" | "eyeoff"
  | "share" | "link" | "menu" | "sun" | "moon" | "auto" | "edit" | "scissors" | "bell";

/** الأيقونات التي يمكن اختيارها لعناصر القائمة من لوحة التحكم. */
export const MENU_ICONS: readonly IconName[] = [
  "home", "bolt", "stack", "live", "game", "spark", "heart", "like", "down", "gift", "mail", "play",
  "star", "film", "book", "music", "fire", "globe", "tv", "info", "camera", "trophy", "user", "search", "history",
];

export type NavItem = { href: string; label: string; icon: IconName };

export const nav: readonly NavItem[] = [
  { href: "/", label: "الرئيسية", icon: "home" },
  { href: "/shorts", label: "قصيرة", icon: "bolt" },
  { href: "/subscriptions", label: "مجموعاتي", icon: "stack" },
  { href: "/games", label: "ألعاب", icon: "game" },
];

export const more: readonly NavItem[] = [
  { href: "/history", label: "سجل المشاهدة", icon: "history" },
  { href: "/downloads", label: "التنزيلات", icon: "down" },
  { href: "/support", label: "ادعمنا", icon: "gift" },
  { href: "/contact", label: "تواصل معنا", icon: "mail" },
];

export type Episode = {
  id: string;
  title: string;
  series: string;
  season: number;
  episode: number;
  duration: string;
  views: number;
  when: string;
  description: string;
  /** معرّف ملف الفيديو في جوجل درايف (اختياري). */
  driveId?: string;
};

// ضع هنا معرّف درايف لكل حلقة: "رقم الحلقة": "معرّف الملف".
// المعرّف هو الجزء بين /d/ و /view في رابط الملف:
// drive.google.com/file/d/<المعرّف>/view
// تذكّر ضبط مشاركة الملف على «أي شخص لديه الرابط – مشاهد».
const DRIVE_IDS: Record<string, string> = {
  // "1": "1AbCdEfGhIjKlMnOpQrStUvWxYz012345",
};

const DEMO_SERIES = [
  { id: "1", name: "المغامرون" },
  { id: "2", name: "حكايات الغابة" },
  { id: "3", name: "الأصدقاء الصغار" },
] as const;
export const SERIES_LIST: readonly { id: string; name: string }[] = SHOW_DEMO_DATA ? DEMO_SERIES : [];
const SERIES = DEMO_SERIES.map((s) => s.name);

// ---- إعدادات الصفحات (املأها بما يناسبك) ----
// بريد استقبال رسائل «تواصل معنا». اتركه فارغًا لتعطيل النموذج.
export const CONTACT_EMAIL = "";
// روابط الدعم (مثال: { label: "ادعمنا عبر ...", href: "https://..." }).
export const SUPPORT_LINKS: readonly { label: string; href: string }[] = [];
// رابط البث المباشر (يوتيوب/غيره). اتركه فارغًا إن لم يوجد بث.
export const LIVE_URL = "";
// قائمة الألعاب: { title, description, href }. اتركها فارغة إن لم توجد.
export const GAMES: readonly { title: string; description: string; href: string }[] = [];
const DURATIONS = ["6:45", "9:46", "3:48", "10:05", "14:08", "4:54"];
const VIEWS = [0, 1, 2, 0, 5, 0];

// بيانات تجريبية — ستُستبدل لاحقًا بقاعدة البيانات.
const DEMO_EPISODES: readonly Episode[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  title: `عنوان الحلقة ${i + 1}`,
  series: SERIES[i % SERIES.length],
  season: 1,
  episode: Math.floor(i / SERIES.length) + 1,
  duration: DURATIONS[i % DURATIONS.length],
  views: VIEWS[i % VIEWS.length],
  when: i < 6 ? "أمس" : "أول أمس",
  description: "وصف تجريبي للحلقة، سيُستبدل بالوصف الحقيقي عند ربط قاعدة البيانات.",
  driveId: DRIVE_IDS[String(i + 1)],
}));
export const episodes: readonly Episode[] = SHOW_DEMO_DATA ? DEMO_EPISODES : [];

export function seriesEpisodes(name: string): Episode[] {
  return episodes.filter((e) => e.series === name);
}

/** الحلقات القصيرة: أقل من 5 دقائق. */
export function isShort(e: Episode): boolean {
  const [m] = e.duration.split(":").map(Number);
  return m < 5;
}

export function getEpisode(id: string): Episode | undefined {
  return episodes.find((e) => e.id === id);
}

export function relatedEpisodes(ep: Episode, limit = 6): Episode[] {
  const same = episodes.filter((e) => e.id !== ep.id && e.series === ep.series);
  const rest = episodes.filter((e) => e.id !== ep.id && e.series !== ep.series);
  return [...same, ...rest].slice(0, limit);
}

// تطبيع عربي خفيف: يزيل التشكيل والتطويل ويوحّد الألف والياء والتاء المربوطة.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

export function searchEpisodes(query: string): Episode[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return episodes.filter((e) => {
    const hay = normalize(`${e.title} ${e.series}`);
    return terms.every((t) => hay.includes(t));
  });
}
