// تحقق مدخلات كتابات المشرف على الخادم (المرحلة 4). دوال خالصة بلا شبكة ولا قاعدة بيانات.
// أي حقل غير مذكور هنا يُهمل (قائمة بيضاء)، فلا يستطيع الطلب كتابة views/likes/created_at أو غيرها من الحقول المحمية.
import { cleanAvatarUrl, cleanCoverImage } from "./coverUrl";
import { AUDIENCE_IDS, BODY_MAX, TITLE_MAX, cleanLink, type Audience } from "./noticeCore";
import { DEFAULT_SETTINGS, merge } from "./settingsCore";
import { MAX_THUMB_DELETE, THUMB_ID, isSavableB64 } from "./thumbCore";
import { VIDEO_ID } from "./visitorInput";

export const MAX_BULK = 1000;
export const MAX_IMPORT = 500;

const str = (v: unknown, max: number): string | null => (typeof v === "string" ? v.trim().slice(0, max) : null);
const intOrNull = (v: unknown): number | null | undefined => {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.max(1, Math.floor(v));
};
const isObj = (b: unknown): b is Record<string, unknown> => !!b && typeof b === "object" && !Array.isArray(b);

/** رابط صورة مصغّرة مقبول: مسار داخلي (/api/thumb/…) أو https فقط. */
export function cleanThumb(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length <= 600 && /^(\/api\/thumb\/[A-Za-z0-9]{10,40}(\?v=\d+)?|https:\/\/)/.test(t) ? t : "";
}

export type VideoPatch = Partial<{
  title: string; description: string; thumbnail: string;
  categoryId: string; categoryName: string; seriesId: string; seriesName: string;
  season: number | null; episode: number | null; isShort: boolean; hidden: boolean;
  duration: number | null; seriesOrder: number | null;
}>;

/** يستخرج الحقول المسموحة من كائن تعديل فيديو. يعيد null إن وُجدت قيمة بنوع خاطئ أو لم يبقَ أي حقل. */
export function cleanVideoPatch(b: unknown): VideoPatch | null {
  if (!isObj(b)) return null;
  const out: VideoPatch = {};
  const text: [keyof VideoPatch, number][] = [["title", 150], ["description", 1000], ["categoryName", 80], ["seriesName", 80]];
  for (const [k, max] of text) {
    if (!(k in b)) continue;
    const v = str(b[k], max);
    if (v === null || (k === "title" && !v)) return null;
    (out as Record<string, unknown>)[k] = v;
  }
  for (const k of ["categoryId", "seriesId"] as const) {
    if (!(k in b)) continue;
    const v = b[k];
    if (typeof v !== "string" || (v !== "" && !VIDEO_ID.test(v))) return null;
    out[k] = v;
  }
  if ("thumbnail" in b) out.thumbnail = cleanThumb(b.thumbnail);
  for (const k of ["isShort", "hidden"] as const) {
    if (!(k in b)) continue;
    if (typeof b[k] !== "boolean") return null;
    out[k] = b[k] as boolean;
  }
  for (const k of ["season", "episode", "seriesOrder", "duration"] as const) {
    if (!(k in b)) continue;
    const v = intOrNull(b[k]);
    if (v === undefined) return null;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export type VideoCreate = {
  title: string; driveId: string; youtubeId: string; thumbnail: string; description: string;
  categoryId: string; categoryName: string; seriesId: string; seriesName: string;
  season: number | null; episode: number | null; isShort: boolean; hidden: boolean; duration: number | null;
  /** معرّف يختاره المتصفح مسبقًا (لحفظ الصورة المصغّرة باسمه قبل إنشاء الفيديو). اختياري. */
  id: string | null;
  /** وقت الإنشاء بالمللي ثانية (للاستيراد الجماعي لحفظ ترتيب الأسماء). اختياري. */
  createdAt: number | null;
};

const DRIVE_ID = /^[A-Za-z0-9_-]{10,100}$/;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const NEW_ID = /^[A-Za-z0-9]{10,40}$/;

/** فيديو جديد: لا بد من driveId أو youtubeId (واحد منهما). */
export function cleanVideoCreate(b: unknown): VideoCreate | null {
  if (!isObj(b)) return null;
  const title = str(b.title, 150);
  if (!title) return null;
  const driveId = typeof b.driveId === "string" ? b.driveId.trim() : "";
  const youtubeId = typeof b.youtubeId === "string" ? b.youtubeId.trim() : "";
  if (driveId ? !DRIVE_ID.test(driveId) || youtubeId : !YT_ID.test(youtubeId)) return null;
  const p = cleanVideoPatch({
    description: b.description ?? "", categoryId: b.categoryId ?? "", categoryName: b.categoryName ?? "",
    seriesId: b.seriesId ?? "", seriesName: b.seriesName ?? "", season: b.season ?? null, episode: b.episode ?? null,
    isShort: b.isShort ?? false, hidden: b.hidden ?? false, duration: b.duration ?? null,
  });
  if (!p) return null;
  const id = b.id === undefined || b.id === null ? null : typeof b.id === "string" && NEW_ID.test(b.id) ? b.id : undefined;
  if (id === undefined) return null;
  const at = typeof b.createdAt === "number" && Number.isFinite(b.createdAt) && b.createdAt > 0 ? Math.floor(b.createdAt) : null;
  return {
    title, driveId, youtubeId, thumbnail: cleanThumb(b.thumbnail), description: p.description ?? "",
    categoryId: p.categoryId ?? "", categoryName: p.categoryName ?? "", seriesId: p.seriesId ?? "", seriesName: p.seriesName ?? "",
    season: p.season ?? null, episode: p.episode ?? null, isShort: p.isShort ?? false, hidden: p.hidden ?? false, duration: p.duration ?? null,
    id, createdAt: at,
  };
}

/** استيراد مجلد: حتى 500 فيديو دفعة واحدة. */
export function cleanImport(b: unknown): VideoCreate[] | null {
  const list = isObj(b) && Array.isArray(b.videos) ? b.videos : null;
  if (!list || list.length === 0 || list.length > MAX_IMPORT) return null;
  const out: VideoCreate[] = [];
  for (const x of list) {
    const v = cleanVideoCreate(x);
    if (!v) return null;
    out.push(v);
  }
  return out;
}

export function cleanIds(v: unknown, max = MAX_BULK): string[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > max) return null;
  const ids = [...new Set(v)];
  return ids.every((i) => typeof i === "string" && VIDEO_ID.test(i)) ? (ids as string[]) : null;
}

/** تعديل جماعي: تصنيف و/أو مجموعة و/أو إخفاء لقائمة معرّفات. */
export function cleanBulk(b: unknown): { ids: string[]; patch: VideoPatch } | null {
  if (!isObj(b)) return null;
  const ids = cleanIds(b.ids);
  const patch = cleanVideoPatch(b.patch);
  if (!ids || !patch) return null;
  // التعديل الجماعي يغيّر التصنيف/المجموعة/الظهور فقط (لا عنوان ولا وصف).
  const allowed = new Set(["categoryId", "categoryName", "seriesId", "seriesName", "season", "episode", "seriesOrder", "hidden"]);
  return Object.keys(patch).every((k) => allowed.has(k)) ? { ids, patch } : null;
}

/** ترتيب حلقات مجموعة: المعرّفات بالترتيب الجديد (1…n). */
export function cleanOrder(b: unknown): { seriesId: string; ids: string[] } | null {
  if (!isObj(b)) return null;
  const ids = cleanIds(b.ids);
  return ids && typeof b.seriesId === "string" && VIDEO_ID.test(b.seriesId) ? { seriesId: b.seriesId, ids } : null;
}

export const NAME_MAX = 80;
/** الاسم بعد ضغط الفراغات (كما يفعل المتصفح). */
export const cleanName = (v: unknown): string | null => {
  const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, NAME_MAX) : "";
  return t || null;
};

export type NamedPatch = Partial<{ name: string; coverVideoId: string; coverImage: string; avatarUrl: string }>;

export function cleanNamedPatch(b: unknown): NamedPatch | null {
  if (!isObj(b)) return null;
  const out: NamedPatch = {};
  if ("name" in b) {
    const n = cleanName(b.name);
    if (!n) return null;
    out.name = n;
  }
  if ("coverVideoId" in b) {
    if (typeof b.coverVideoId !== "string" || (b.coverVideoId !== "" && !VIDEO_ID.test(b.coverVideoId))) return null;
    out.coverVideoId = b.coverVideoId;
  }
  if ("coverImage" in b) out.coverImage = cleanCoverImage(b.coverImage);
  if ("avatarUrl" in b) out.avatarUrl = cleanAvatarUrl(b.avatarUrl);
  return Object.keys(out).length ? out : null;
}

export type ReportOp = { op: "done" | "delete"; id: string } | { op: "hide"; id: string; videoId: string };

export function cleanReportOp(b: unknown): ReportOp | null {
  if (!isObj(b) || typeof b.id !== "string" || !/^[A-Za-z0-9]{10,40}$/.test(b.id)) return null;
  if (b.op === "done" || b.op === "delete") return { op: b.op, id: b.id };
  if (b.op === "hide" && typeof b.videoId === "string" && VIDEO_ID.test(b.videoId)) return { op: "hide", id: b.id, videoId: b.videoId };
  return null;
}

// ───────── الإعدادات (المرحلة 6): settings/site وتخطيط اللوحة settings/adminLayout ─────────

const SITE_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

/**
 * تعديل إعدادات الموقع: الحقول المعروفة فقط، وكل قيمة تمرّ على merge نفسها التي تنظّفها عند القراءة
 * (فلا يُكتب شعار أو رابط أو لون غير صالح). الحقل غير المعروف يُهمل، ولا حقول معروفة = رفض.
 * يعيد المفاتيح المرسَلة فقط؛ الخادم يدمجها فوق المحفوظ فلا يُمحى ما لم يُرسَل.
 */
export function cleanSitePatch(b: unknown): Record<string, unknown> | null {
  if (!isObj(b) || !isObj(b.patch)) return null;
  const keys = Object.keys(b.patch).filter((k) => SITE_KEYS.has(k));
  if (!keys.length) return null;
  const cleaned = merge(b.patch) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = cleaned[k];
  return out;
}

export const MAX_LAYOUT_JSON = 100_000;

/** تخطيط اللوحة: نصّان JSON (الترتيب والبنية) كما كانا في Firestore. يُرفض ما ليس JSON كائنًا أو مصفوفة أو ما زاد عن الحد. */
export function cleanLayout(b: unknown): { json: string; structure: string } | null {
  if (!isObj(b)) return null;
  const ok = (v: unknown): v is string => {
    if (typeof v !== "string" || v.length > MAX_LAYOUT_JSON) return false;
    try {
      const j: unknown = JSON.parse(v);
      return !!j && typeof j === "object";
    } catch {
      return false;
    }
  };
  return ok(b.json) && ok(b.structure) ? { json: b.json, structure: b.structure } : null;
}

// ───────── الإشعارات (المرحلة 6ب) ─────────

export type NoticeCreate = { title: string; body: string; link: string; audiences: Audience[] };

/** إرسال إشعار: عنوان، نص اختياري، رابط داخلي/https اختياري، وفئة أو أكثر («الجميع» لا تُجمع مع غيرها، كما في اللوحة). */
export function cleanNoticeCreate(b: unknown): NoticeCreate | null {
  if (!isObj(b)) return null;
  const title = str(b.title, TITLE_MAX);
  const body = b.body === undefined ? "" : str(b.body, BODY_MAX);
  const rawLink = b.link === undefined ? "" : typeof b.link === "string" ? b.link.trim() : null;
  if (!title || body === null || rawLink === null) return null;
  const link = cleanLink(rawLink);
  if (rawLink && !link) return null;
  const list = Array.isArray(b.audiences) ? [...new Set(b.audiences)] : null;
  if (!list || !list.length || !list.every((a): a is Audience => (AUDIENCE_IDS as readonly unknown[]).includes(a))) return null;
  if (list.includes("all") && list.length > 1) return null;
  return { title, body, link, audiences: list };
}

const NOTICE_ID = /^[A-Za-z0-9_-]{1,60}$/;
/** حذف إشعارات بمعرّفاتها (إشعار واحد لكل فئة، فحتى 4 عادةً؛ الحد 20 للأمان). */
export function cleanNoticeIds(b: unknown): string[] | null {
  const ids = isObj(b) && Array.isArray(b.ids) ? [...new Set(b.ids)] : null;
  return ids && ids.length > 0 && ids.length <= 20 && ids.every((i): i is string => typeof i === "string" && NOTICE_ID.test(i)) ? (ids as string[]) : null;
}

// ───────── الصور المصغّرة (المرحلة 6ج) ─────────

/** حفظ صورة: معرّف صالح + JPEG base64 ضمن الحد. */
export function cleanThumbSave(b: unknown): { id: string; b64: string } | null {
  return isObj(b) && typeof b.id === "string" && THUMB_ID.test(b.id) && isSavableB64(b.b64) ? { id: b.id, b64: b.b64 } : null;
}

/** حذف صور بمعرّفاتها (حتى 1000 دفعة واحدة لحذف الفيديوهات الجماعي). */
export function cleanThumbIds(b: unknown): string[] | null {
  const ids = isObj(b) && Array.isArray(b.ids) ? [...new Set(b.ids)] : null;
  return ids && ids.length > 0 && ids.length <= MAX_THUMB_DELETE && ids.every((i): i is string => typeof i === "string" && THUMB_ID.test(i)) ? (ids as string[]) : null;
}
