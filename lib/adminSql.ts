// أجزاء SQL الخالصة لكتابات المشرف (بلا اتصال بالقاعدة، فتُختبر مباشرة). تستعملها lib/neonAdmin.ts.
import { randomBytes } from "node:crypto";
import type { VideoPatch } from "./adminInput";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** معرّف جديد من 20 حرفًا وأرقامًا (بشكل معرّفات Firestore نفسه فتبقى كل الأنماط والروابط صالحة). */
export function newId(): string {
  const b = randomBytes(20);
  let s = "";
  for (let i = 0; i < 20; i++) s += ALPHA[b[i] % 62];
  return s;
}

// الحقل بالواجهة -> عمود الجدول (قائمة ثابتة: لا يدخل اسم عمود من المستخدم في SQL أبدًا).
const COLUMN: Record<keyof VideoPatch, string> = {
  title: "title", description: "description", thumbnail: "thumbnail",
  categoryId: "category_id", categoryName: "category_name", seriesId: "series_id", seriesName: "series_name",
  season: "season", episode: "episode", isShort: "is_short", hidden: "hidden", duration: "duration", seriesOrder: "series_order",
};

/** يبني «col = $n, …» من حقول التعديل. المعاملات تبدأ من $first. */
export function setClause(patch: VideoPatch, first: number): { sql: string; params: unknown[] } {
  const keys = (Object.keys(patch) as (keyof VideoPatch)[]).filter((k) => k in COLUMN);
  return { sql: keys.map((k, i) => `${COLUMN[k]} = $${first + i}`).join(", "), params: keys.map((k) => patch[k]) };
}


// ───────── الإعدادات (المرحلة 6) ─────────
/** دمج سطحي للحقول المرسَلة فوق settings/site (مثل updateDoc): ما لم يُرسَل يبقى، وإن لم يوجد الصف يُنشأ. المعامل $1 = JSON الحقول. */
export const SAVE_SITE_SQL =
  "insert into settings (key, data) values ('site', $1::jsonb) on conflict (key) do update set data = settings.data || excluded.data, updated_at = now()";
/** حفظ تخطيط اللوحة كاملًا (مثل setDoc): $1 = نص الترتيب، $2 = نص البنية. */
export const SAVE_LAYOUT_SQL =
  "insert into settings (key, data) values ('adminLayout', jsonb_build_object('json', $1::text, 'structure', $2::text)) on conflict (key) do update set data = excluded.data, updated_at = now()";
export const RESET_LAYOUT_SQL = "delete from settings where key = 'adminLayout'";

// ───────── الإشعارات (المرحلة 6ب) ─────────
/** أحدث $2 إشعارات لكل فئة من الفئات $1 (مصفوفة نصوص)، مرتبة بالأحدث أولًا. */
export const LIST_NOTICES_SQL =
  "select id, title, body, link, audience, created_at from (select *, row_number() over (partition by audience order by created_at desc, id) as rn from notifications where audience = any($1::text[])) t where rn <= $2 order by created_at desc, id";
/** قائمة المشرف: كل الفئات، حتى 100 (كما كان limit(100)). */
export const ADMIN_LIST_NOTICES_SQL = "select id, title, body, link, audience, created_at from notifications order by created_at desc, id limit 100";
/** إدراج عدة صفوف (إشعار لكل فئة) في جملة واحدة. $1 = JSON مصفوفة {id,title,body,link,audience}. */
export const INSERT_NOTICES_SQL =
  "insert into notifications (id, title, body, link, audience) select x.id, x.title, x.body, x.link, x.audience from jsonb_to_recordset($1::jsonb) as x(id text, title text, body text, link text, audience text)";
/** يحذف ما زاد عن آخر $1 إشعارًا في كل فئة. */
export const PRUNE_NOTICES_SQL =
  "delete from notifications where id in (select id from (select id, row_number() over (partition by audience order by created_at desc, id) as rn from notifications) t where rn > $1)";
export const DELETE_NOTICES_SQL = "delete from notifications where id = any($1::text[])";
export const OPEN_REPORTS_COUNT_SQL = "select count(*)::int as n from reports where status = 'open'";

// ───────── الإحصاءات (تبويب الإحصاءات في اللوحة) ─────────
/** مجاميع الموقع في جملة واحدة: مشاهدات وإعجابات وعدد الفيديوهات والمخفي والقصير والبلاغات المفتوحة. */
export const STATS_TOTALS_SQL =
  "select coalesce(sum(views), 0)::bigint as views, coalesce(sum(likes), 0)::bigint as likes, count(*)::int as videos, " +
  "(count(*) filter (where hidden))::int as hidden, (count(*) filter (where is_short))::int as shorts, " +
  "(select count(*)::int from reports where status = 'open') as reports_open from videos";
/** مشاهدات الأيام منذ $1 (YYYY-MM-DD بتوقيت UTC) بالأقدم أولًا، بحد أقصى $2 صفًّا. */
// مقارنة نصّية (YYYY-MM-DD ترتّب كالتاريخ) كي يعمل الاستعلام سواء كان عمود day من نوع date أو نصًّا.
export const STATS_DAILY_SQL = "select day::text as day, views from stats where day::text >= $1::text order by 1 limit $2::int";

// ───────── الصور المصغّرة (المرحلة 6ج) ─────────
export const SAVE_THUMB_SQL = "insert into thumbs (id, b64) values ($1, $2) on conflict (id) do update set b64 = excluded.b64, updated_at = now()";
export const DELETE_THUMBS_SQL = "delete from thumbs where id = any($1::text[])";
export const READ_THUMB_SQL = "select b64 from thumbs where id = $1";
