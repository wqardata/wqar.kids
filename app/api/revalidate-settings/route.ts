import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { adminFromToken, bearer } from "@/lib/serverAuth";
import { SETTINGS_TAG } from "@/lib/serverSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** يُستدعى بعد حفظ الإعدادات: يُبطل النسخة المخزّنة على الخادم (للمشرفين فقط). */
export async function POST(req: NextRequest) {
  const who = await adminFromToken(bearer(req));
  if ("error" in who) return NextResponse.json({ error: "غير مصرّح." }, { status: 403 });
  revalidateTag(SETTINGS_TAG);
  return NextResponse.json({ ok: true });
}
