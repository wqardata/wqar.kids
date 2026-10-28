// طلبات المتصفح إلى /api/admin/* (كتابات المشرف على Neon، المرحلة 4). تُرفق رمز Firebase الحالي.
// تُستعمل فقط حين NEXT_PUBLIC_DATA_BACKEND=neon. ترمي خطأ إن لم ينجح الطلب كي يعرض المتصل رسالته كما كان عند فشل Firestore.
import { getFirebaseAuth } from "./firebase";
import type { NamedOut } from "./neonRows";
import type { ReportOut, StatsTotalsOut } from "./neonAdmin";
import type { Audience, Notice } from "./noticeCore";
import type { VideoDoc } from "./videos";
import type { NamedPatch, VideoCreate, VideoPatch } from "./adminInput";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const token = await getFirebaseAuth().currentUser?.getIdToken();
  if (!token) throw new Error("401");
  const r = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

export type NewVideo = Partial<Omit<VideoCreate, "title">> & { title: string };

export const adminVideoList = (seriesId?: string) => call<VideoDoc[]>(`/api/admin/videos${seriesId ? `?seriesId=${encodeURIComponent(seriesId)}` : ""}`);
export const adminCreateVideo = (video: NewVideo) => call<{ id: string }>("/api/admin/videos", { op: "create", video }).then((r) => r.id);
export const adminImportVideos = (videos: NewVideo[]) => call<{ ids: string[] }>("/api/admin/videos", { op: "import", videos }).then((r) => r.ids);
export const adminPatchVideo = (id: string, patch: VideoPatch) => call<{ ok: true }>("/api/admin/videos", { op: "patch", id, patch });
export const adminBulkPatch = (ids: string[], patch: VideoPatch) => call<{ count: number }>("/api/admin/videos", { op: "bulk", ids, patch }).then((r) => r.count);
export const adminDeleteVideos = (ids: string[]) => call<{ count: number }>("/api/admin/videos", { op: "delete", ids }).then((r) => r.count);
export const adminSetOrder = (seriesId: string, ids: string[]) => call<{ count: number }>("/api/admin/videos", { op: "order", seriesId, ids }).then((r) => r.count);

export type Coll = "categories" | "series";
export const adminNamedList = (coll: Coll) => call<NamedOut[]>(`/api/admin/named?coll=${coll}`);
export const adminCreateNamed = (coll: Coll, name: string) => call<{ id: string }>("/api/admin/named", { coll, op: "create", name }).then((r) => r.id);
export const adminUpdateNamed = (coll: Coll, id: string, patch: NamedPatch) => call<{ videos: number }>("/api/admin/named", { coll, op: "update", id, patch });
export const adminDeleteNamed = (coll: Coll, id: string) => call<{ detached: number }>("/api/admin/named", { coll, op: "delete", id });

export const adminReports = (includeDone: boolean) => call<ReportOut[]>(`/api/admin/reports${includeDone ? "?done=1" : ""}`);
export const adminReportOp = (op: "done" | "delete", id: string): Promise<void> => call<{ ok: true }>("/api/admin/reports", { op, id }).then(() => undefined);
export const adminHideFromReport = (id: string, videoId: string): Promise<void> => call<{ ok: true }>("/api/admin/reports", { op: "hide", id, videoId }).then(() => undefined);

// الإعدادات (المرحلة 6): settings/site (حقول معدَّلة فقط) وتخطيط اللوحة.
export const adminSaveSite = (patch: Record<string, unknown>): Promise<void> => call<{ ok: true }>("/api/admin/settings", { op: "site", patch }).then(() => undefined);
export const adminGetLayout = () => call<{ exists: boolean; data: { json?: string; structure?: string } }>("/api/admin/settings?key=adminLayout");
export const adminSaveLayout = (json: string, structure: string): Promise<void> => call<{ ok: true }>("/api/admin/settings", { op: "layout", json, structure }).then(() => undefined);
export const adminResetLayout = (): Promise<void> => call<{ ok: true }>("/api/admin/settings", { op: "resetLayout" }).then(() => undefined);

// الإشعارات (المرحلة 6ب) وعدّاد البلاغات المفتوحة للجرس.
export const adminNotices = () => call<Notice[]>("/api/admin/notifications");
export const adminSendNotice = (n: { title: string; body: string; link: string; audiences: Audience[] }): Promise<void> => call<{ ok: true }>("/api/admin/notifications", { op: "create", ...n }).then(() => undefined);
export const adminDeleteNotices = (ids: string[]): Promise<void> => call<{ ok: true }>("/api/admin/notifications", { op: "delete", ids }).then(() => undefined);
export const adminOpenReportsCount = () => call<{ count: number }>("/api/admin/reports?count=1").then((r) => r.count);

// الصور المصغّرة (المرحلة 6ج).
export const adminSaveThumb = (id: string, b64: string): Promise<void> => call<{ ok: true }>("/api/admin/thumbs", { op: "save", id, b64 }).then(() => undefined);
export const adminDeleteThumbs = (ids: string[]): Promise<void> => call<{ ok: true }>("/api/admin/thumbs", { op: "delete", ids }).then(() => undefined);

// الإحصاءات (تبويب الإحصاءات): المجاميع ومشاهدات الأيام من Neon.
export const adminStatsTotals = () => call<StatsTotalsOut>("/api/admin/stats?kind=totals");
export const adminStatsDaily = (start: string, days: number) => call<{ day: string; views: number }[]>(`/api/admin/stats?kind=daily&start=${encodeURIComponent(start)}&days=${days}`);
