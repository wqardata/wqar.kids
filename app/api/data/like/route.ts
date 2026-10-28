import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { changeLike } from "@/lib/neonWrites";
import { allow, clientKey } from "@/lib/rateLimit";
import { cleanDelta, cleanVideoId } from "@/lib/visitorInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/data/like {id, delta: 1|-1} — يغيّر عدّاد المعجبين بمقدار 1 دون النزول عن الصفر، ويعيد {likes}. */
export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DATABASE_URL غير مضبوط" }, { status: 503 });
  if (!allow(`like:${clientKey(req)}`, 60, 60_000)) return NextResponse.json({ error: "محاولات كثيرة" }, { status: 429 });
  const body = await req.json().catch(() => null);
  const id = cleanVideoId(body);
  const delta = cleanDelta(body);
  if (!id || !delta) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  try {
    const likes = await changeLike(id, delta);
    return likes === null ? NextResponse.json({ error: "غير موجود" }, { status: 404 }) : NextResponse.json({ likes });
  } catch {
    return NextResponse.json({ error: "تعذّر الاتصال بالقاعدة" }, { status: 502 });
  }
}
