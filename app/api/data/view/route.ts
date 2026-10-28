import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { recordView } from "@/lib/neonWrites";
import { allow, clientKey } from "@/lib/rateLimit";
import { cleanVideoId } from "@/lib/visitorInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/data/view {id} — يزيد مشاهدات الفيديو وإحصاء اليوم. المتصفح يرسله مرة لكل فيديو في كل جلسة. */
export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DATABASE_URL غير مضبوط" }, { status: 503 });
  if (!allow(`view:${clientKey(req)}`, 120, 60_000)) return NextResponse.json({ error: "محاولات كثيرة" }, { status: 429 });
  const id = cleanVideoId(await req.json().catch(() => null));
  if (!id) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
  try {
    return (await recordView(id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "غير موجود" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "تعذّر الاتصال بالقاعدة" }, { status: 502 });
  }
}
