// غيّر اسم الموقع ووصفه من هنا — يُستخدم في العنوان والـ manifest والهيدر.
export const SITE_NAME = "موقعي";
export const SITE_DESCRIPTION = "مشاهدة آمنة بلا إعلانات";

export type IconName =
  | "home" | "bolt" | "stack" | "live" | "game" | "spark"
  | "heart" | "down" | "gift" | "mail" | "search" | "play" | "user";

export type NavItem = { href: string; label: string; icon: IconName };

export const nav: readonly NavItem[] = [
  { href: "/", label: "الرئيسية", icon: "home" },
  { href: "/shorts", label: "قصيرة", icon: "bolt" },
  { href: "/subscriptions", label: "مجموعاتي", icon: "stack" },
  { href: "/live", label: "بث مباشر", icon: "live" },
  { href: "/games", label: "ألعاب", icon: "game" },
];

export const more: readonly NavItem[] = [
  { href: "/new", label: "الجديد", icon: "spark" },
  { href: "/favorites", label: "المفضلة", icon: "heart" },
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
};

const SERIES = ["المغامرون", "حكايات الغابة", "الأصدقاء الصغار"];
const DURATIONS = ["6:45", "9:46", "3:48", "10:05", "14:08", "4:54"];
const VIEWS = [0, 1, 2, 0, 5, 0];

// بيانات تجريبية — ستُستبدل لاحقًا بقاعدة البيانات.
export const episodes: readonly Episode[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  title: `عنوان الحلقة ${i + 1}`,
  series: SERIES[i % SERIES.length],
  season: 1,
  episode: Math.floor(i / SERIES.length) + 1,
  duration: DURATIONS[i % DURATIONS.length],
  views: VIEWS[i % VIEWS.length],
  when: i < 6 ? "أمس" : "أول أمس",
  description: "وصف تجريبي للحلقة، سيُستبدل بالوصف الحقيقي عند ربط قاعدة البيانات.",
}));

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
