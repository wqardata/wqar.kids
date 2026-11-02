// كتابات الزوار على Neon (المرحلة 3). للخادم فقط. كل عملية جملة SQL واحدة ذرّية (بدل قواعد Firestore).
import { randomUUID } from "node:crypto";
import { query } from "./db";
import { createViewBuffer } from "./viewBuffer";
import type { ReportInput } from "./visitorInput";

/**
 * يكتب دفعة مشاهدات واحدة: يزيد views لكل فيديو موجود، ويزيد عدّاد اليوم (UTC) بمجموع ما أُضيف فعلًا،
 * ولا يُنشئ يومًا إلا إن وُجد فيديو واحد على الأقل. معرّفات غير موجودة تُتجاهل بصمت.
 */
export async function flushViews(counts: Map<string, number>): Promise<void> {
  if (counts.size === 0) return;
  await query(
    `with p as (select * from unnest($1::text[], $2::int[]) as t(id, n)),
          v as (update videos set views = videos.views + p.n from p where videos.id = p.id returning p.n),
          s as (insert into stats (day, views) select (now() at time zone 'utc')::date, sum(n)::int from v having sum(n) > 0
                on conflict (day) do update set views = stats.views + excluded.views returning 1)
     select count(*)::text as n from v`,
    [[...counts.keys()], [...counts.values()]],
  );
}

// مشاهدات الزوار تُجمَّع في ذاكرة الخادم وتُكتب كل 5 دقائق (lib/viewBuffer.ts) لتقليل إيقاظ Neon.
const views = createViewBuffer(flushViews);

/** مشاهدة: تُسجَّل في الذاكرة وتُكتب في القاعدة دفعة لاحقًا. لا تتحقق من وجود الفيديو (يُتجاهل المعرّف غير الموجود عند الكتابة). */
export async function recordView(id: string): Promise<boolean> {
  await views.add(id);
  return true;
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
