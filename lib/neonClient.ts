// طلبات المتصفح إلى مسارات القراءة العامة /api/data/* (تُستعمل فقط حين NEXT_PUBLIC_DATA_BACKEND=neon).
import type { NamedOut } from "./neonRows";
import type { Notice } from "./noticeCore";
import type { VideoDoc } from "./videos";

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

export const neonLatest = (max: number) => get<VideoDoc[]>(`/api/data/videos?latest=${max}`);
export const neonAllVideos = () => get<VideoDoc[]>("/api/data/videos?all=1");
export const neonVideosByIds = (ids: string[]) => get<VideoDoc[]>(`/api/data/videos?ids=${ids.map(encodeURIComponent).join(",")}`);
export const neonVideosByCategory = (id: string) => get<VideoDoc[]>(`/api/data/videos?categoryId=${encodeURIComponent(id)}`);
export const neonVideosBySeries = (id: string) => get<VideoDoc[]>(`/api/data/videos?seriesId=${encodeURIComponent(id)}`);
export const neonNamedList = (coll: "categories" | "series") => get<NamedOut[]>(`/api/data/named?coll=${coll}`);

/** عنصر واحد، أو null إن لم يوجد (404). */
export async function neonNamedOne(coll: "categories" | "series", id: string): Promise<NamedOut | null> {
  const r = await fetch(`/api/data/named?coll=${coll}&id=${encodeURIComponent(id)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as NamedOut;
}

/** فيديو واحد بمعرّفه (يشمل المخفي كما كان Firestore)، أو null. */
export async function neonVideo(id: string): Promise<VideoDoc | null> {
  return (await neonVideosByIds([id]))[0] ?? null;
}

export type SettingsDoc = { exists: boolean; data: Record<string, unknown> };
/** fresh=true يتجاوز كاش الشبكة القصير (للمشرف قبل الحفظ، كي لا يقارن بنسخة قديمة). */
export const neonSetting = (key: "site" | "videosVersion", fresh = false) => get<SettingsDoc>(`/api/data/settings?key=${key}${fresh ? `&_=${Date.now()}` : ""}`);

/** كتابة زائر (POST JSON). ترمي خطأ إن لم ينجح الطلب، فيتراجع المتصل كما كان يفعل عند فشل Firestore. */
export async function neonPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

/** إشعارات الزائر الحالي: الخادم يحدّد الفئات من رمز Firebase (بدونه = زائر). */
export async function neonNotices(n: number, token?: string): Promise<Notice[]> {
  const r = await fetch(`/api/data/notifications?n=${Math.floor(n)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as Notice[];
}
