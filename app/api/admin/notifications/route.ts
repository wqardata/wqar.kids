import { NextResponse } from "next/server";
import { cleanNoticeCreate, cleanNoticeIds } from "@/lib/adminInput";
import { bad, dbDown, requireAdmin } from "@/lib/adminRoute";
import { adminListNotices, createNotices, deleteNotices } from "@/lib/neonNotices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/notifications — كل الإشعارات المرسلة (حتى 100، الأحدث أولًا). */
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  try {
    return NextResponse.json(await adminListNotices(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return dbDown();
  }
}

/** POST {op:"create", title, body?, link?, audiences[]} | {op:"delete", ids[]} */
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => null)) as { op?: unknown } | null;
  try {
    if (b?.op === "create") {
      const n = cleanNoticeCreate(b);
      if (!n) return bad();
      return NextResponse.json({ ok: true, count: await createNotices(n) });
    }
    if (b?.op === "delete") {
      const ids = cleanNoticeIds(b);
      if (!ids) return bad();
      return NextResponse.json({ ok: true, count: await deleteNotices(ids) });
    }
    return bad();
  } catch {
    return dbDown();
  }
}
