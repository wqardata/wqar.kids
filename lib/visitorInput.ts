// تحقق مدخلات كتابات الزوار على الخادم. يطابق حدود firestore.rules (البلاغات: videoId ≤ 40، videoTitle ≤ 200، reason ≤ 80، note ≤ 500).
// دوال خالصة بلا شبكة ولا قاعدة بيانات.

export const VIDEO_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type ReportInput = { videoId: string; videoTitle: string; reason: string; note: string };

/** يعيد البلاغ المنظَّف أو null إن كان غير صالح (سبب فارغ، معرّف غير صالح، أنواع خاطئة…). الحقول الطويلة تُقصّ كما يفعل المتصفح. */
export function cleanReport(b: unknown): ReportInput | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  if (typeof o.videoId !== "string" || !VIDEO_ID.test(o.videoId) || o.videoId.length > 40) return null;
  if (typeof o.reason !== "string" || !o.reason.trim()) return null;
  const title = typeof o.videoTitle === "string" ? o.videoTitle : "";
  const note = typeof o.note === "string" ? o.note : "";
  return { videoId: o.videoId, videoTitle: title.slice(0, 200), reason: o.reason.trim().slice(0, 80), note: note.trim().slice(0, 500) };
}

/** معرّف فيديو صالح من جسم الطلب {id}، أو null. */
export function cleanVideoId(b: unknown): string | null {
  const id = b && typeof b === "object" ? (b as Record<string, unknown>).id : null;
  return typeof id === "string" && VIDEO_ID.test(id) ? id : null;
}

/** تغيير الإعجاب: +1 أو −1 فقط (كما في القواعد). */
export function cleanDelta(b: unknown): 1 | -1 | null {
  const d = b && typeof b === "object" ? (b as Record<string, unknown>).delta : null;
  return d === 1 || d === -1 ? d : null;
}
