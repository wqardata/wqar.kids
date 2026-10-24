import type { NextRequest } from "next/server";
import { DRIVE_ID } from "@/lib/drive";
import { fail, streamDrive } from "@/lib/driveStream";
import { decodeFields } from "@/lib/serverSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** معرّفات درايف الموجودة الآن في قوائم البث الفعّالة (العام + أيام الأسبوع). تُخزَّن دقيقة واحدة لتخفيف القراءات. */
let cache: { at: number; ids: Set<string> } | null = null;

const STREAM_DOC = /^(current|day[0-6])$/;

async function liveDriveIds(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.ids;
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const ids = new Set<string>();
  if (!pid) return ids;
  try {
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents/live?pageSize=20${key ? `&key=${encodeURIComponent(key)}` : ""}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    if (r.ok) {
      const j = (await r.json()) as { documents?: Array<{ name?: string; fields?: Record<string, never> }> };
      for (const doc of j.documents ?? []) {
        const id = (doc.name ?? "").split("/").pop() ?? "";
        if (!STREAM_DOC.test(id)) continue;
        const d = decodeFields(doc.fields ?? {});
        if (d.active === true && Array.isArray(d.items)) {
          for (const it of d.items as Array<Record<string, unknown>>) if (typeof it?.driveId === "string") ids.add(it.driveId);
        }
      }
    }
  } catch {
    /* نُبقي المجموعة فارغة */
  }
  cache = { at: Date.now(), ids };
  return ids;
}

/**
 * يمرّر فيديو من قائمة البث المباشر الحالية فقط إلى كل الزوار، كي يُعرض في مشغّل مخصّص
 * (بلا إيقاف مؤقت، مع التحكم بالصوت). أي معرّف ليس في قائمة بث نشط (عام أو يومي) يُرفض.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!DRIVE_ID.test(id)) return fail(400, "معرّف درايف غير صالح.");
  if (!(await liveDriveIds()).has(id)) return fail(403, "هذا الفيديو ليس ضمن البث الحالي.");
  return streamDrive(req, id);
}
