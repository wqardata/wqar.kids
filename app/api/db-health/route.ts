import { NextResponse } from "next/server";
import { isDbConfigured, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** فحص اتصال Neon: يعيد { ok, tables } فقط (لا بيانات). افتحه في المتصفح بعد ضبط DATABASE_URL: /api/db-health */
export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ ok: false, reason: "DATABASE_URL غير مضبوط" }, { status: 503 });
  try {
    const rows = await query<{ n: string }>("select count(*)::text as n from information_schema.tables where table_schema = 'public'");
    return NextResponse.json({ ok: true, tables: Number(rows[0]?.n ?? 0) });
  } catch {
    return NextResponse.json({ ok: false, reason: "تعذّر الاتصال بالقاعدة" }, { status: 502 });
  }
}
