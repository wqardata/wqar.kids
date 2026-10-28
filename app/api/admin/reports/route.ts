import { NextResponse } from "next/server";
import { cleanReportOp } from "@/lib/adminInput";
import { bad, dbDown, notFound, requireAdmin } from "@/lib/adminRoute";
import { listReports, reportOp } from "@/lib/neonAdmin";
import { openReportsCount } from "@/lib/neonNotices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/reports[?done=1] — البلاغات المفتوحة (ومعها المنتهية عند done=1). ‎?count=1 → {count} عدد المفتوحة فقط (لعدّاد الجرس). */
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  try {
    if (new URL(req.url).searchParams.get("count") === "1") return NextResponse.json({ count: await openReportsCount() }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(await listReports(new URL(req.url).searchParams.get("done") === "1"), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return dbDown();
  }
}

/** POST /api/admin/reports {op: done|delete|hide, id, videoId?} */
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  const o = cleanReportOp(await req.json().catch(() => null));
  if (!o) return bad();
  try {
    return (await reportOp(o)) ? NextResponse.json({ ok: true }) : notFound();
  } catch {
    return dbDown();
  }
}
