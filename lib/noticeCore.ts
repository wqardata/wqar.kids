// الجزء النقي من الإشعارات (بلا React ولا Firebase) ليعمل في الخادم والمتصفح معًا. lib/notifications.ts يعيد تصديره.
import { NOTICE_COUNT_MAX, cleanUrl } from "./settingsCore";

export type Audience = "all" | "viewers" | "admins" | "guests";
export const AUDIENCE_IDS: readonly Audience[] = ["guests", "viewers", "admins", "all"];
export type Notice = { id: string; title: string; body: string; link: string; audience: Audience; at: number };

/** كم إشعارًا يُحتفظ به لكل فئة (الأقدم يُحذف عند الإرسال). عدد الظاهر منها يحدّده المشرف (≤ هذا الحد). */
export const NOTICE_KEEP = NOTICE_COUNT_MAX;

export const TITLE_MAX = 80;
export const BODY_MAX = 500;

/** المعرّف يبدأ بالوقت معكوسًا، فترتيب المعرّفات التصاعدي = الأحدث أولًا. */
export function newNoticeId(): string {
  const rev = String(9_999_999_999_999 - Date.now()).padStart(13, "0");
  return `${rev}-${Math.random().toString(36).slice(2, 7)}`;
}

/** رابط داخلي (يبدأ بـ /) أو http(s) فقط؛ غير ذلك يُحذف. */
export function cleanLink(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("/") && !t.startsWith("//") && t.length <= 300 && !/\s/.test(t)) return t;
  return cleanUrl(t);
}

/** الفئات التي يقرؤها كل نوع من الزوّار: «all» للكل، ثم فئته الخاصة: الزائر «guests»، العضو «viewers»، المشرف «admins». */
export function audiencesFor(uid: string | null, isAdmin: boolean): Audience[] {
  if (!uid) return ["all", "guests"];
  return isAdmin ? ["all", "admins"] : ["all", "viewers"];
}

// صف جدول notifications في Neon -> Notice (دالة نقية فتُختبر دون قاعدة).
export type NoticeRow = { id: string; title: string; body: string; link: string; audience: string; created_at: Date | string | null };

export function rowToNotice(r: NoticeRow): Notice {
  const t = r.created_at instanceof Date ? r.created_at.getTime() : r.created_at ? Date.parse(r.created_at) : NaN;
  return {
    id: r.id,
    title: String(r.title ?? "").slice(0, 80),
    body: String(r.body ?? "").slice(0, 500),
    link: cleanLink(String(r.link ?? "")),
    audience: (AUDIENCE_IDS as readonly string[]).includes(r.audience) ? (r.audience as Audience) : "all",
    at: Number.isFinite(t) ? t : Date.now(),
  };
}
