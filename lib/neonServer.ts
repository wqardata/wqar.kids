// قراءات Neon العامة (للقراءة فقط) على الخادم. تستعملها مسارات /api/data/* و lib/shareMeta.ts و lib/serverSettings.ts.
// لا تستورد هذا الملف من مكوّن "use client".
import { query } from "./db";
import { READ_THUMB_SQL } from "./adminSql";
import { rowToNamed, rowToVideo, type NamedOut, type NamedRow, type VideoRow } from "./neonRows";
import type { VideoDoc } from "./videos";

const COLS = "id, title, drive_id, youtube_id, thumbnail, category_id, category_name, series_id, series_name, season, episode, is_short, hidden, duration, clip, series_order, views, likes, created_at";
/** القوائم تُقصّ فيها الوصف إلى 300 حرف (كما كان يفعل التخزين المؤقت في المتصفح)؛ فيديو واحد يعود بوصفه كاملًا. */
const LIST = `${COLS}, left(description, 300) as description`;
const FULL = `${COLS}, description`;
const VISIBLE = "hidden = false and clip = false";

export const MAX_LATEST = 1000;
export const MAX_ALL = 20000; // نفس الحماية القديمة: 40 صفحة × 500
export const MAX_IDS = 100;

const videos = async (sql: string, params: unknown[] = []): Promise<VideoDoc[]> => (await query<VideoRow>(sql, params)).map(rowToVideo);

/** أحدث الفيديوهات الظاهرة للزوار. */
export const latestVideos = (limit: number) =>
  videos(`select ${LIST} from videos where ${VISIBLE} order by created_at desc, id limit $1`, [Math.min(Math.max(1, Math.floor(limit) || 1), MAX_LATEST)]);

/** كل الفيديوهات الظاهرة (الأحدث أولًا). */
export const allVideos = () => videos(`select ${LIST} from videos where ${VISIBLE} order by created_at desc, id limit ${MAX_ALL}`);

/** فيديوهات تصنيف أو مجموعة (الظاهرة فقط). */
export const videosBy = (field: "category_id" | "series_id", id: string) => {
  if (field !== "category_id" && field !== "series_id") throw new Error("حقل غير مسموح");
  return videos(`select ${LIST} from videos where ${field} = $1 and ${VISIBLE} order by created_at desc, id`, [id]);
};

/** فيديوهات بمعرّفاتها كما في Firestore: تشمل المخفي (يقرّر الاستدعاء)، وتحافظ على ترتيب المعرّفات الممرَّرة. */
export async function videosByIds(ids: string[]): Promise<VideoDoc[]> {
  const list = [...new Set(ids)].slice(0, MAX_IDS);
  if (!list.length) return [];
  const got = await videos(`select ${FULL} from videos where id = any($1::text[])`, [list]);
  const by = new Map(got.map((v) => [v.id, v]));
  return list.map((i) => by.get(i)).filter((v): v is VideoDoc => Boolean(v));
}

const NAMED_TABLE = { categories: "categories", series: "series" } as const;
export type NamedColl = keyof typeof NAMED_TABLE;
export const isNamedColl = (v: string | null): v is NamedColl => v === "categories" || v === "series";

/** قائمة التصنيفات/المجموعات مرتبة بالاسم (ترتيب بايتات UTF-8 كما يفعل Firestore). */
export async function namedList(coll: NamedColl): Promise<NamedOut[]> {
  const rows = await query<NamedRow>(`select id, name, cover_video_id, cover_image, avatar_url from ${NAMED_TABLE[coll]} order by name collate "C", id`);
  return rows.map(rowToNamed);
}

export async function namedOne(coll: NamedColl, id: string): Promise<NamedOut | null> {
  const rows = await query<NamedRow>(`select id, name, cover_video_id, cover_image, avatar_url from ${NAMED_TABLE[coll]} where id = $1`, [id]);
  return rows[0] ? rowToNamed(rows[0]) : null;
}

/** مستند إعدادات واحد (مثل 'site' أو 'videosVersion'). null = غير موجود. */
export async function settingDoc(key: string): Promise<Record<string, unknown> | null> {
  const rows = await query<{ data: Record<string, unknown> }>("select data from settings where key = $1", [key]);
  const d = rows[0]?.data;
  return d && typeof d === "object" ? d : null;
}

/** مفاتيح الإعدادات المسموح قراءتها علنًا (القراءة عامة في firestore.rules لكل مستندات settings). */
export const PUBLIC_SETTING_KEYS = ["site", "videosVersion"] as const;

/** حقول مستند (فيديو/مجموعة/تصنيف) بنفس أسماء Firestore، لاستعمالها في بيانات المعاينة على الخادم. null = غير موجود. */
export async function docFields(coll: "videos" | "series" | "categories", id: string): Promise<Record<string, unknown> | null> {
  if (coll === "videos") {
    const v = (await videosByIds([id]))[0];
    // المقطع القديم (clip) مخفي أصلًا في VideoDoc، فلا حاجة لإعادة clipStart/clipEnd.
    return v ? { title: v.title, driveId: v.driveId, youtubeId: v.youtubeId, thumbnail: v.thumbnail, description: v.description, seriesName: v.seriesName, hidden: v.hidden } : null;
  }
  const n = await namedOne(coll, id);
  return n ? { name: n.name, coverImage: n.coverImage, avatarUrl: n.avatarUrl, coverVideoId: n.coverVideoId } : null;
}

/** base64 للصورة المصغّرة (JPEG) أو null إن لم توجد. التحقق من الصيغة في المسار قبل الخدمة. */
export async function thumbB64(id: string): Promise<string | null> {
  const rows = await query<{ b64: string }>(READ_THUMB_SQL, [id]);
  return typeof rows[0]?.b64 === "string" ? rows[0].b64 : null;
}
