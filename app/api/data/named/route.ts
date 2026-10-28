import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { isNamedColl, namedList, namedOne } from "@/lib/neonServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

/** GET /api/data/named?coll=categories|series[&id=…] — قائمة التصنيفات/المجموعات، أو عنصر واحد (404 إن لم يوجد). */
export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DATABASE_URL غير مضبوط" }, { status: 503 });
  const p = new URL(req.url).searchParams;
  const coll = p.get("coll");
  if (!isNamedColl(coll)) return NextResponse.json({ error: "مجموعة غير معروفة" }, { status: 400 });
  try {
    const id = p.get("id");
    if (id === null) return NextResponse.json(await namedList(coll), { headers: CACHE });
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    const one = await namedOne(coll, id);
    return one ? NextResponse.json(one, { headers: CACHE }) : NextResponse.json({ error: "غير موجود" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "تعذّر الاتصال بالقاعدة" }, { status: 502 });
  }
}
