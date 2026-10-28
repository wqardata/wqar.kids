import { NextResponse } from "next/server";
import { bad, dbDown, requireAdmin } from "@/lib/adminRoute";
import { statsDaily, statsTotals } from "@/lib/neonAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

/**
 * GET /api/admin/stats?kind=totals — مجاميع الموقع {views, likes, videos, hidden, shorts, reportsOpen}.
 * GET /api/admin/stats?kind=daily&start=YYYY-MM-DD&days=90 — [{day, views}] للأيام الموجودة فقط (المتصل يملأ الخالية بصفر).
 */
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind");
  const headers = { "Cache-Control": "no-store" };
  if (kind === "totals") {
    try {
      return NextResponse.json(await statsTotals(), { headers });
    } catch {
      return dbDown();
    }
  }
  if (kind === "daily") {
    const start = q.get("start") ?? "";
    const days = Math.floor(Number(q.get("days")));
    if (!DAY_RE.test(start) || Number.isNaN(Date.parse(start)) || !Number.isFinite(days) || days < 1 || days > MAX_DAYS) return bad();
    try {
      return NextResponse.json(await statsDaily(start, days + 5), { headers });
    } catch {
      return dbDown();
    }
  }
  return bad();
}
