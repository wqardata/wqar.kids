import { NextResponse } from "next/server";
import { cleanThumbIds, cleanThumbSave } from "@/lib/adminInput";
import { bad, dbDown, requireAdmin } from "@/lib/adminRoute";
import { deleteThumbRows, saveThumbRow } from "@/lib/neonAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST {op:"save", id, b64} | {op:"delete", ids[]} — الصور المصغّرة (المشرف فقط). القراءة العامة عبر GET /api/thumb/[id]. */
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => null)) as { op?: unknown } | null;
  try {
    if (b?.op === "save") {
      const t = cleanThumbSave(b);
      if (!t) return bad();
      await saveThumbRow(t.id, t.b64);
      return NextResponse.json({ ok: true });
    }
    if (b?.op === "delete") {
      const ids = cleanThumbIds(b);
      if (!ids) return bad();
      return NextResponse.json({ ok: true, count: await deleteThumbRows(ids) });
    }
    return bad();
  } catch {
    return dbDown();
  }
}
