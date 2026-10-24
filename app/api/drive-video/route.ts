import { NextResponse, type NextRequest } from "next/server";
import { DRIVE_ID } from "@/lib/drive";
import { fail, streamDrive } from "@/lib/driveStream";
import { adminFromToken, bearer } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * وسيط يمرّر بايتات فيديو درايف إلى متصفح المشرف من نفس نطاق الموقع.
 * الغرض الوحيد: التقاط لقطة (canvas) من الفيديو؛ المتصفح يمنع قراءة بكسلات فيديو من نطاق آخر.
 * محصور بالمشرفين. <video> لا يرسل ترويسات مخصصة، فيُقبل التوكن في ?token= (صلاحيته ساعة ويُستعمل لطلبك أنت فقط).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || bearer(req);
  const who = await adminFromToken(token);
  if ("error" in who) return who.error === "unauthorized" ? fail(401, "غير مصرّح.") : fail(403, "هذا الحساب غير مخوّل.");

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!DRIVE_ID.test(id)) return fail(400, "معرّف درايف غير صالح.");
  return streamDrive(req, id);
}
