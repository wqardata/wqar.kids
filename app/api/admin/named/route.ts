import { NextResponse } from "next/server";
import { cleanName, cleanNamedPatch } from "@/lib/adminInput";
import { bad, dbDown, notFound, requireAdmin } from "@/lib/adminRoute";
import { createNamed, deleteNamed, updateNamed } from "@/lib/neonAdmin";
import { isNamedColl, namedList } from "@/lib/neonServer";
import { VIDEO_ID } from "@/lib/visitorInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/named?coll=categories|series — القائمة بدون كاش (القراءة العامة مكاشة 60 ثانية). */
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  const coll = new URL(req.url).searchParams.get("coll");
  if (!isNamedColl(coll)) return bad();
  try {
    return NextResponse.json(await namedList(coll), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return dbDown();
  }
}

/** POST /api/admin/named {coll, op: create|update|delete, …} */
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !isNamedColl(typeof body.coll === "string" ? body.coll : null)) return bad();
  const coll = body.coll as "categories" | "series";
  const id = typeof body.id === "string" && VIDEO_ID.test(body.id) ? body.id : null;
  try {
    if (body.op === "create") {
      const name = cleanName(body.name);
      return name ? NextResponse.json({ id: await createNamed(coll, name) }) : bad();
    }
    if (body.op === "update") {
      const p = cleanNamedPatch(body.patch);
      if (!id || !p) return bad();
      // الغلاف والصورة تخصّان المجموعات فقط (كما في الواجهة).
      if (coll === "categories" && ("coverVideoId" in p || "coverImage" in p || "avatarUrl" in p)) return bad();
      const r = await updateNamed(coll, id, p);
      return r ? NextResponse.json(r) : notFound();
    }
    if (body.op === "delete") {
      if (!id) return bad();
      const r = await deleteNamed(coll, id);
      return r ? NextResponse.json(r) : notFound();
    }
    return bad();
  } catch {
    return dbDown();
  }
}
