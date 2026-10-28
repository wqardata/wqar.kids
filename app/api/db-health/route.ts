import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * فحص اتصال Neon: يعيد { ok, tables } فقط (لا بيانات). للمشرفين فقط (Authorization: Bearer <رمز Firebase>)،
 * كي لا يوقظ أي زائر حساب Neon بطلبات متكررة. بديل عملي للفحص: افتح تبويب «الإحصاءات» في لوحة التحكم (يقرأ من Neon).
 */
export async function GET(req: Request) {
  const a = await requireAdmin(req); // يتضمن فحص DATABASE_URL (503) والرمز (401/403) وحد المعدّل
  if (a instanceof NextResponse) return a;
  try {
    const rows = await query<{ n: string }>("select count(*)::text as n from information_schema.tables where table_schema = 'public'");
    return NextResponse.json({ ok: true, tables: Number(rows[0]?.n ?? 0) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, reason: "تعذّر الاتصال بالقاعدة" }, { status: 502 });
  }
}
