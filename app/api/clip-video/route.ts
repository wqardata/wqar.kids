import type { NextRequest } from "next/server";
import { DRIVE_ID } from "@/lib/drive";
import { fail, streamDrive } from "@/lib/driveStream";
import { decodeFields } from "@/lib/serverSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** نتيجة التحقق لكل معرّف درايف (تُخزَّن دقيقة لتخفيف قراءات Firestore). */
const cache = new Map<string, { at: number; ok: boolean }>();

/** هل يوجد مقطع مقتطع ظاهر (غير مخفي) يستعمل هذا الملف؟ */
async function hasPublicClip(driveId: string): Promise<boolean> {
  const hit = cache.get(driveId);
  if (hit && Date.now() - hit.at < 60_000) return hit.ok;
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  let ok = false;
  if (pid) {
    try {
      const r = await fetch(
        `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents:runQuery${key ? `?key=${encodeURIComponent(key)}` : ""}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "videos" }],
              where: {
                compositeFilter: {
                  op: "AND",
                  filters: [
                    { fieldFilter: { field: { fieldPath: "driveId" }, op: "EQUAL", value: { stringValue: driveId } } },
                    { fieldFilter: { field: { fieldPath: "isShort" }, op: "EQUAL", value: { booleanValue: true } } },
                  ],
                },
              },
              limit: 25,
            },
          }),
        },
      );
      if (r.ok) {
        const rows = (await r.json()) as Array<{ document?: { fields?: Record<string, never> } }>;
        ok = rows.some((row) => {
          if (!row.document) return false;
          const d = decodeFields(row.document.fields ?? {});
          return d.hidden !== true && typeof d.clipStart === "number" && typeof d.clipEnd === "number";
        });
      }
    } catch {
      /* نرفض عند أي خطأ */
    }
  }
  cache.set(driveId, { at: Date.now(), ok });
  return ok;
}

/**
 * يمرّر بايتات ملف درايف لمشغّل المقاطع المقتطعة (يُشغَّل فيه جزء من الفيديو فقط بإطار طولي).
 * لا يخدم إلا ملفات يستعملها مقطع قصير مقتطع ظاهر؛ أي معرّف آخر يُرفض.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!DRIVE_ID.test(id)) return fail(400, "معرّف درايف غير صالح.");
  if (!(await hasPublicClip(id))) return fail(403, "هذا الملف ليس ضمن مقطع مقتطع منشور.");
  return streamDrive(req, id);
}
