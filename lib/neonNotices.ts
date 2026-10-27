// الإشعارات على Neon (المرحلة 6ب). للخادم فقط. القراءة العامة تحدّد الفئات في المسار بحسب رمز Firebase؛ والكتابة للمشرف بعد requireAdmin.
import { query } from "./db";
import { ADMIN_LIST_NOTICES_SQL, DELETE_NOTICES_SQL, INSERT_NOTICES_SQL, LIST_NOTICES_SQL, OPEN_REPORTS_COUNT_SQL, PRUNE_NOTICES_SQL } from "./adminSql";
import type { NoticeCreate } from "./adminInput";
import { NOTICE_KEEP, newNoticeId, rowToNotice, type Audience, type Notice, type NoticeRow as Row } from "./noticeCore";

/** أحدث `per` إشعارات لكل فئة من `auds`، مرتبة بالأحدث أولًا. */
export async function listNotices(auds: Audience[], per: number): Promise<Notice[]> {
  const n = Math.min(NOTICE_KEEP, Math.max(1, Math.floor(per) || 1));
  return (await query<Row>(LIST_NOTICES_SQL, [auds, n])).map(rowToNotice);
}

export async function adminListNotices(): Promise<Notice[]> {
  return (await query<Row>(ADMIN_LIST_NOTICES_SQL)).map(rowToNotice);
}

/** صف لكل فئة مختارة (جملة واحدة ذرّية)، ثم تنظيف الأقدم من آخر NOTICE_KEEP في كل فئة. فشل التنظيف لا يُفشل الإرسال. */
export async function createNotices(n: NoticeCreate): Promise<number> {
  const rows = n.audiences.map((audience) => ({ id: newNoticeId(), title: n.title, body: n.body, link: n.link, audience }));
  await query(INSERT_NOTICES_SQL, [JSON.stringify(rows)]);
  try {
    await query(PRUNE_NOTICES_SQL, [NOTICE_KEEP]);
  } catch {
    /* التنظيف اختياري: القائمة تعرض العدد المضبوط على أي حال */
  }
  return rows.length;
}

export async function deleteNotices(ids: string[]): Promise<number> {
  return (await query(DELETE_NOTICES_SQL + " returning id", [ids])).length;
}

export async function openReportsCount(): Promise<number> {
  const r = await query<{ n: number }>(OPEN_REPORTS_COUNT_SQL);
  return Number(r[0]?.n ?? 0);
}
