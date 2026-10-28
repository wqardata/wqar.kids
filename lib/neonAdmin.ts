// كتابات المشرف على Neon (المرحلة 4). للخادم فقط. كل عملية جملة SQL واحدة ذرّية.
// الصلاحية (adminFromToken) تُفحص في مسارات /api/admin/* قبل استدعاء أي دالة هنا.
import { query } from "./db";
import type { NamedPatch, ReportOp, VideoCreate, VideoPatch } from "./adminInput";
import { DELETE_THUMBS_SQL, RESET_LAYOUT_SQL, SAVE_LAYOUT_SQL, SAVE_SITE_SQL, SAVE_THUMB_SQL, STATS_DAILY_SQL, STATS_TOTALS_SQL, newId, setClause } from "./adminSql";
import { settingDoc } from "./neonServer";
import { rowToVideo, type VideoRow } from "./neonRows";
import type { VideoDoc } from "./videos";

const COLS = "id, title, drive_id, youtube_id, thumbnail, description, category_id, category_name, series_id, series_name, season, episode, is_short, hidden, duration, clip, series_order, views, likes, created_at";

/** يرفع رقم إصدار الفيديوهات فتتحدّث أجهزة الزوار (كان bumpVideosVersion يكتبه في Firestore). */
export async function bumpVersion(): Promise<number> {
  const v = Date.now();
  await query("insert into settings (key, data) values ('videosVersion', jsonb_build_object('v', $1::bigint)) on conflict (key) do update set data = excluded.data, updated_at = now()", [v]);
  return v;
}

/** قائمة الفيديوهات للمشرف: تشمل المخفي والمقاطع القديمة (الأحدث أولًا، حتى 1000 كما كان). */
export async function adminVideos(seriesId?: string): Promise<VideoDoc[]> {
  const rows = seriesId
    ? await query<VideoRow>(`select ${COLS} from videos where series_id = $1 order by created_at desc, id`, [seriesId])
    : await query<VideoRow>(`select ${COLS} from videos order by created_at desc, id limit 1000`);
  return rows.map(rowToVideo);
}

/** فيديوهات جديدة (واحد أو أكثر) في جملة واحدة. تعيد المعرّفات بالترتيب. */
export async function createVideos(list: VideoCreate[]): Promise<string[]> {
  const base = Date.now();
  const rows = list.map((v, i) => ({
    id: v.id ?? newId(), title: v.title, drive_id: v.driveId, youtube_id: v.youtubeId, thumbnail: v.thumbnail, description: v.description,
    category_id: v.categoryId, category_name: v.categoryName, series_id: v.seriesId, series_name: v.seriesName,
    season: v.season, episode: v.episode, is_short: v.isShort, hidden: v.hidden, duration: v.duration,
    created_ms: v.createdAt ?? base + i,
  }));
  await query(
    `insert into videos (id, title, drive_id, youtube_id, thumbnail, description, category_id, category_name, series_id, series_name, season, episode, is_short, hidden, duration, created_at)
     select x.id, x.title, x.drive_id, x.youtube_id, x.thumbnail, x.description, x.category_id, x.category_name, x.series_id, x.series_name, x.season, x.episode, x.is_short, x.hidden, x.duration, to_timestamp(x.created_ms / 1000.0)
     from jsonb_to_recordset($1::jsonb) as x(id text, title text, drive_id text, youtube_id text, thumbnail text, description text, category_id text, category_name text, series_id text, series_name text, season int, episode int, is_short boolean, hidden boolean, duration int, created_ms bigint)`,
    [JSON.stringify(rows)],
  );
  await bumpVersion();
  return rows.map((r) => r.id);
}

/** تعديل فيديو واحد. false = غير موجود. */
export async function patchVideo(id: string, patch: VideoPatch): Promise<boolean> {
  const s = setClause(patch, 2);
  if (!s.sql) return false;
  const rows = await query(`update videos set ${s.sql} where id = $1 returning id`, [id, ...s.params]);
  if (rows.length) await bumpVersion();
  return rows.length > 0;
}

/** تعديل جماعي. يعيد عدد المعدَّل. */
export async function bulkPatch(ids: string[], patch: VideoPatch): Promise<number> {
  const s = setClause(patch, 2);
  if (!s.sql) return 0;
  const rows = await query(`update videos set ${s.sql} where id = any($1::text[]) returning id`, [ids, ...s.params]);
  if (rows.length) await bumpVersion();
  return rows.length;
}

/** حذف فيديوهات (وبصماتها). يعيد عدد المحذوف. */
export async function deleteVideos(ids: string[]): Promise<number> {
  const rows = await query<{ n: string }>(
    `with d as (delete from videos where id = any($1::text[]) returning id),
          f as (delete from fingerprints where id in (select id from d) returning 1)
     select count(*)::text as n from d`,
    [ids],
  );
  const n = Number(rows[0]?.n ?? 0);
  if (n) await bumpVersion();
  return n;
}

/** يكتب series_order = 1…n لحلقات المجموعة بالترتيب الممرَّر (لا يمسّ فيديو من مجموعة أخرى). */
export async function setSeriesOrder(seriesId: string, ids: string[]): Promise<number> {
  const rows = await query(
    `update videos v set series_order = x.ord::int
     from unnest($1::text[]) with ordinality as x(id, ord)
     where v.id = x.id and v.series_id = $2 returning v.id`,
    [ids, seriesId],
  );
  if (rows.length) await bumpVersion();
  return rows.length;
}

// ---- التصنيفات والمجموعات ----
export type Coll = "categories" | "series";
const T = {
  categories: { table: "categories", idCol: "category_id", nameCol: "category_name", detach: "category_id = '', category_name = ''" },
  series: { table: "series", idCol: "series_id", nameCol: "series_name", detach: "series_id = '', series_name = '', season = null, episode = null, series_order = null" },
} as const;

export async function createNamed(coll: Coll, name: string): Promise<string> {
  const id = newId();
  await query(`insert into ${T[coll].table} (id, name) values ($1, $2)`, [id, name]);
  return id;
}

const NCOL: Record<keyof NamedPatch, string> = { name: "name", coverVideoId: "cover_video_id", coverImage: "cover_image", avatarUrl: "avatar_url" };

/** تعديل تصنيف/مجموعة؛ وعند تغيير الاسم يُزامَن في نسخ الاسم داخل الفيديوهات في الجملة نفسها. null = غير موجود. */
export async function updateNamed(coll: Coll, id: string, patch: NamedPatch): Promise<{ videos: number } | null> {
  const t = T[coll];
  const keys = (Object.keys(patch) as (keyof NamedPatch)[]).filter((k) => k in NCOL);
  if (!keys.length) return null;
  const params: unknown[] = [id, ...keys.map((k) => patch[k])];
  const set = keys.map((k, i) => `${NCOL[k]} = $${i + 2}`).join(", ");
  const nameIdx = keys.indexOf("name") + 2; // رقم معامل الاسم ($1 للمعرّف ثم الحقول بالترتيب)
  const syncNames = keys.includes("name")
    ? `, v as (update videos set ${t.nameCol} = $${nameIdx} where ${t.idCol} = $1 and exists (select 1 from u) returning 1)`
    : "";
  const rows = await query<{ found: number; videos: number }>(
    `with u as (update ${t.table} set ${set} where id = $1 returning id)${syncNames}
     select (select count(*) from u)::int as found, ${keys.includes("name") ? "(select count(*) from v)::int" : "0"} as videos`,
    params,
  );
  const r = rows[0];
  if (!r || r.found === 0) return null;
  if (keys.includes("name")) await bumpVersion();
  return { videos: r.videos };
}

/** حذف تصنيف/مجموعة مع فصل فيديوهاتها في جملة واحدة (إمّا الكل أو لا شيء). null = غير موجود. */
export async function deleteNamed(coll: Coll, id: string): Promise<{ detached: number } | null> {
  const t = T[coll];
  const rows = await query<{ deleted: number; detached: number }>(
    `with v as (update videos set ${t.detach} where ${t.idCol} = $1 returning 1),
          d as (delete from ${t.table} where id = $1 returning 1)
     select (select count(*) from d)::int as deleted, (select count(*) from v)::int as detached`,
    [id],
  );
  const r = rows[0];
  if (!r || r.deleted === 0) return null;
  await bumpVersion();
  return { detached: r.detached };
}

// ---- البلاغات ----
export type ReportOut = { id: string; videoId: string; videoTitle: string; reason: string; note: string; status: "open" | "done"; at: number | null };

export async function listReports(includeDone: boolean): Promise<ReportOut[]> {
  const rows = await query<{ id: string; video_id: string; video_title: string; reason: string; note: string; status: string; created_at: Date | string | null }>(
    `select id, video_id, video_title, reason, note, status, created_at from reports where status = 'open' ${includeDone ? "or status = 'done'" : ""} order by (status = 'open') desc, created_at desc limit 400`,
  );
  return rows.map((r) => {
    const t = r.created_at instanceof Date ? r.created_at.getTime() : r.created_at ? Date.parse(r.created_at) : NaN;
    return { id: r.id, videoId: r.video_id, videoTitle: r.video_title, reason: r.reason, note: r.note, status: r.status === "done" ? "done" : "open", at: Number.isFinite(t) ? t : null };
  });
}

/** يعيد true إن وُجد الهدف. */
export async function reportOp(o: ReportOp): Promise<boolean> {
  if (o.op !== "hide") {
    const sql = o.op === "done" ? "update reports set status = 'done' where id = $1 returning id" : "delete from reports where id = $1 returning id";
    return (await query(sql, [o.id])).length > 0;
  }
  const ok = (await query("update videos set hidden = true where id = $1 returning id", [o.videoId])).length > 0;
  if (ok) await bumpVersion();
  return ok;
}

// ───────── الإعدادات (المرحلة 6) ─────────

/** يدمج حقول الإعدادات المُنظَّفة فوق settings/site في جملة واحدة. */
export async function saveSiteSettings(patch: Record<string, unknown>): Promise<void> {
  await query(SAVE_SITE_SQL, [JSON.stringify(patch)]);
}

/** تخطيط اللوحة المحفوظ، أو null إن لم يُحفظ (فيُستعمل التخطيط الافتراضي). */
export async function getAdminLayout(): Promise<{ json: string; structure: string } | null> {
  const d = await settingDoc("adminLayout");
  return d ? { json: typeof d.json === "string" ? d.json : "", structure: typeof d.structure === "string" ? d.structure : "" } : null;
}

export async function saveAdminLayout(l: { json: string; structure: string }): Promise<void> {
  await query(SAVE_LAYOUT_SQL, [l.json, l.structure]);
}

export async function resetAdminLayout(): Promise<void> {
  await query(RESET_LAYOUT_SQL);
}

// ───────── الصور المصغّرة (المرحلة 6ج) ─────────

export async function saveThumbRow(id: string, b64: string): Promise<void> {
  await query(SAVE_THUMB_SQL, [id, b64]);
}

/** يعيد عدد الصور المحذوفة. */
export async function deleteThumbRows(ids: string[]): Promise<number> {
  return (await query(`${DELETE_THUMBS_SQL} returning id`, [ids])).length;
}

export type StatsTotalsOut = { views: number; likes: number; videos: number; hidden: number; shorts: number; reportsOpen: number };

/** مجاميع الموقع لتبويب الإحصاءات (جملة واحدة). */
export async function statsTotals(): Promise<StatsTotalsOut> {
  const r = (await query<{ views: string | number; likes: string | number; videos: number; hidden: number; shorts: number; reports_open: number }>(STATS_TOTALS_SQL))[0];
  const n = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  return { views: n(r?.views), likes: n(r?.likes), videos: n(r?.videos), hidden: n(r?.hidden), shorts: n(r?.shorts), reportsOpen: n(r?.reports_open) };
}

/** مشاهدات الأيام من `start` (YYYY-MM-DD) فصاعدًا. التعبئة بالأصفار للأيام الخالية تتم عند المتصل. */
export async function statsDaily(start: string, limit: number): Promise<{ day: string; views: number }[]> {
  const rows = await query<{ day: string; views: number }>(STATS_DAILY_SQL, [start, limit]);
  return rows.map((x) => ({ day: String(x.day).slice(0, 10), views: Number(x.views) || 0 }));
}
