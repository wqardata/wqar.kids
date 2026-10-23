import { NextResponse, type NextRequest } from "next/server";
import { adminFromToken, bearer } from "@/lib/serverAuth";
import { fsDelete, fsList, fsPatch, serviceAccountConfigured } from "@/lib/serverFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
const ID = /^[A-Za-z0-9]{10,40}$/;

async function guard(req: NextRequest): Promise<NextResponse | null> {
  if (!serviceAccountConfigured()) return err(501, "not-configured");
  const who = await adminFromToken(bearer(req));
  if ("error" in who) return err(who.error === "unauthorized" ? 401 : 403, "غير مصرّح.");
  return null;
}

/** قراءة البلاغات وإدارتها للمشرفين عبر حساب الخدمة (لا تحتاج قواعد Firestore). */
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  try {
    const docs = await fsList("reports", "createdAt desc", 100);
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    return NextResponse.json({
      reports: docs.map((d) => ({
        id: d.id,
        videoId: s(d.data.videoId),
        videoTitle: s(d.data.videoTitle),
        reason: s(d.data.reason),
        note: s(d.data.note),
        status: d.data.status === "done" ? "done" : "open",
        at: typeof d.data.createdAt === "string" ? Date.parse(d.data.createdAt) || null : null,
      })),
    });
  } catch {
    return err(502, "تعذّر قراءة البلاغات.");
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { id?: unknown };
  if (typeof b.id !== "string" || !ID.test(b.id)) return err(400, "معرّف غير صالح.");
  try {
    await fsPatch("reports", b.id, { status: "done", updatedAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch {
    return err(502, "تعذّر التحديث.");
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!ID.test(id)) return err(400, "معرّف غير صالح.");
  try {
    await fsDelete("reports", id);
    return NextResponse.json({ ok: true });
  } catch {
    return err(502, "تعذّر الحذف.");
  }
}
