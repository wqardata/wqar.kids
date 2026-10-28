import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { cleanLayout, cleanSitePatch } from "@/lib/adminInput";
import { bad, dbDown, requireAdmin } from "@/lib/adminRoute";
import { getAdminLayout, resetAdminLayout, saveAdminLayout, saveSiteSettings } from "@/lib/neonAdmin";
import { SETTINGS_TAG } from "@/lib/serverSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/settings?key=adminLayout → { exists, data: {json, structure} } (للمشرفين فقط؛ إعدادات الموقع العامة تُقرأ من /api/data/settings). */
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  if (new URL(req.url).searchParams.get("key") !== "adminLayout") return bad();
  try {
    const l = await getAdminLayout();
    return NextResponse.json({ exists: l !== null, data: l ?? {} }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return dbDown();
  }
}

/** POST {op:"site", patch} | {op:"layout", json, structure} | {op:"resetLayout"} */
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (a instanceof NextResponse) return a;
  const b = (await req.json().catch(() => null)) as { op?: unknown } | null;
  try {
    if (b?.op === "site") {
      const patch = cleanSitePatch(b);
      if (!patch) return bad();
      await saveSiteSettings(patch);
      revalidateTag(SETTINGS_TAG); // يظهر الاسم/الشعار الجديد في أول HTML للجميع فورًا (بدل انتظار 5 دقائق)
      return NextResponse.json({ ok: true });
    }
    if (b?.op === "layout") {
      const l = cleanLayout(b);
      if (!l) return bad();
      await saveAdminLayout(l);
      return NextResponse.json({ ok: true });
    }
    if (b?.op === "resetLayout") {
      await resetAdminLayout();
      return NextResponse.json({ ok: true });
    }
    return bad();
  } catch {
    return dbDown();
  }
}
