import type { IconName } from "./data";

/** الصور الرمزية الجاهزة: أيقونة بيضاء على خلفية ملوّنة. الأولى هي الافتراضية (أيقونة شخص). */
export const AVATARS: readonly { id: string; bg: string; icon: IconName; label: string }[] = [
  { id: "p-teal", bg: "#0f766e", icon: "user", label: "شخص أخضر مزرق" },
  { id: "p-blue", bg: "#2563eb", icon: "user", label: "شخص أزرق" },
  { id: "p-purple", bg: "#7c3aed", icon: "user", label: "شخص بنفسجي" },
  { id: "p-pink", bg: "#db2777", icon: "user", label: "شخص وردي" },
  { id: "p-orange", bg: "#ea580c", icon: "user", label: "شخص برتقالي" },
  { id: "p-green", bg: "#16a34a", icon: "user", label: "شخص أخضر" },
  { id: "p-red", bg: "#dc2626", icon: "user", label: "شخص أحمر" },
  { id: "p-slate", bg: "#475569", icon: "user", label: "شخص رمادي" },
  { id: "g-star", bg: "#d97706", icon: "star", label: "نجمة" },
  { id: "g-heart", bg: "#e11d48", icon: "heart", label: "قلب" },
  { id: "g-fire", bg: "#f97316", icon: "fire", label: "نار" },
  { id: "g-music", bg: "#0891b2", icon: "music", label: "موسيقى" },
  { id: "g-film", bg: "#4f46e5", icon: "film", label: "أفلام" },
  { id: "g-game", bg: "#65a30d", icon: "game", label: "ألعاب" },
  { id: "g-trophy", bg: "#ca8a04", icon: "trophy", label: "كأس" },
  { id: "g-globe", bg: "#0d9488", icon: "globe", label: "عالم" },
];

export const DEFAULT_AVATAR = AVATARS[0].id;

export function avatarById(id?: string | null) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

export function isAvatarId(id: unknown): id is string {
  return typeof id === "string" && AVATARS.some((a) => a.id === id);
}
