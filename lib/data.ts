// غيّر اسم الموقع من هنا
export const SITE_NAME = "موقعي";

export const nav = [
  { href: "/", label: "الرئيسية", icon: "home" },
  { href: "/shorts", label: "قصيرة", icon: "bolt" },
  { href: "/subscriptions", label: "مجموعاتي", icon: "stack" },
  { href: "/live", label: "بث مباشر", icon: "live" },
  { href: "/games", label: "ألعاب", icon: "game" },
] as const;

export const more = [
  { href: "/new", label: "الجديد", icon: "spark" },
  { href: "/favorites", label: "المفضلة", icon: "heart" },
  { href: "/downloads", label: "التنزيلات", icon: "down" },
  { href: "/support", label: "ادعمنا", icon: "gift" },
  { href: "/contact", label: "تواصل معنا", icon: "mail" },
] as const;

export type Episode = {
  id: string; title: string; series: string; season: number; episode: number;
  duration: string; views: number; when: string;
};

// بيانات تجريبية — ستُستبدل لاحقًا بقاعدة البيانات
export const episodes: Episode[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  title: `عنوان الحلقة ${i + 1}`,
  series: ["المغامرون", "حكايات الغابة", "الأصدقاء الصغار"][i % 3],
  season: 1,
  episode: (i % 9) + 1,
  duration: ["6:45", "9:46", "3:48", "10:05", "14:08", "4:54"][i % 6],
  views: [0, 1, 2, 0, 5, 0][i % 6],
  when: i < 6 ? "أمس" : "أول أمس",
}));
