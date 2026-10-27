import { NextResponse } from "next/server";
import { cleanBulk, cleanIds, cleanImport, cleanOrder, cleanVideoCreate, cleanVideoPatch } from "@/lib/adminInput";
import { bad, dbDown, notFound, requireAdmin } from "@/lib/adminRoute";
import { VIDEO_ID } from "@/lib/visitorInput";
import { adminVideos, bulkPatch, createVideos, deleteVideos, patchVideo, setSeriesOrder } from "@/lib/neonAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/videos[?seriesId=…] — كل الفيديوهات للمشرف (تشمل المخفي)، دون كاش. */
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  const sid = new URL(req.url).searchParams.get("seriesId");
  if (sid !== null && !VIDEO_ID.test(sid)) return bad();
  try {
    return NextResponse.json(await adminVideos(sid ?? undefined), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return dbDown();
  }
}

/**
 * POST /api/admin/videos {op, …}
 *   create {video}            → {id}
 *   import {videos[]}         → {ids[]}
 *   patch  {id, patch}        → {ok}
 *   bulk   {ids[], patch}     → {count}
 *   delete {ids[]}            → {count}
 *   order  {seriesId, ids[]}  → {count}
 */
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.op !== "string") return bad();
  try {
    switch (body.op) {
      case "create": {
        const v = cleanVideoCreate(body.video);
        return v ? NextResponse.json({ id: (await createVideos([v]))[0] }) : bad();
      }
      case "import": {
        const list = cleanImport(body);
        return list ? NextResponse.json({ ids: await createVideos(list) }) : bad();
      }
      case "patch": {
        const id = typeof body.id === "string" && VIDEO_ID.test(body.id) ? body.id : null;
        const p = cleanVideoPatch(body.patch);
        if (!id || !p) return bad();
        return (await patchVideo(id, p)) ? NextResponse.json({ ok: true }) : notFound();
      }
      case "bulk": {
        const b = cleanBulk(body);
        return b ? NextResponse.json({ count: await bulkPatch(b.ids, b.patch) }) : bad();
      }
      case "delete": {
        const ids = cleanIds(body.ids);
        return ids ? NextResponse.json({ count: await deleteVideos(ids) }) : bad();
      }
      case "order": {
        const o = cleanOrder(body);
        return o ? NextResponse.json({ count: await setSeriesOrder(o.seriesId, o.ids) }) : bad();
      }
      default:
        return bad();
    }
  } catch {
    return dbDown();
  }
}
