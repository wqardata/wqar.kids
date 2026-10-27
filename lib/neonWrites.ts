// كتابات الزوار على Neon (المرحلة 3). للخادم فقط. كل عملية جملة SQL واحدة ذرّية (بدل قواعد Firestore).
import { randomUUID } from "node:crypto";
import { query } from "./db";
import type { ReportInput } from "./visitorInput";

/**
 * مشاهدة: يزيد views للفيديو ويزيد عدّاد اليوم (UTC) في الجملة نفسها، ولا يُنشئ يومًا إلا إن وُجد الفيديو.
 * يعيد false إن لم يوجد الفيديو.
 */
export async function recordView(id: string): Promise<boolean> {
  const rows = await query<{ n: string }>(
    `with v as (update videos set views = views + 1 where id = $1 returning 1),
          s as (insert into stats (day, views) select (now() at time zone 'utc')::date, 1 from v
                on conflict (day) do update set views = stats.views + 1 returning 1)
     select count(*)::text as n from v`,
    [id],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** إعجاب +1 أو −1 دون النزول عن الصفر. يعيد العدد الجديد أو null إن لم يوجد الفيديو. */
export async function changeLike(id: string, delta: 1 | -1): Promise<number | null> {
  const rows = await query<{ likes: number }>("update videos set likes = greatest(likes + $2::int, 0) where id = $1 returning likes", [id, delta]);
  return rows[0] ? rows[0].likes : null;
}

/** بلاغ جديد بحالة open. يعيد معرّفه. */
export async function addReport(r: ReportInput): Promise<string> {
  const id = randomUUID().replace(/-/g, "");
  await query("insert into reports (id, video_id, video_title, reason, note, status) values ($1, $2, $3, $4, $5, 'open')", [id, r.videoId, r.videoTitle, r.reason, r.note]);
  return id;
}
