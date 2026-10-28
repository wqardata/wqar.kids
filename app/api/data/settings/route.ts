import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { allow, clientKey } from "@/lib/rateLimit";
import { PUBLIC_SETTING_KEYS, settingDoc } from "@/lib/neonServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/data/settings?key=site|videosVersion → { exists, data }. قصير الكاش: رقم إصدار الفيديوهات يجب أن يظهر تغييره سريعًا. */
export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DATABASE_URL غير مضبوط" }, { status: 503 });
  // الطلبات التي تُخدم من كاش CDN لا تصل هنا؛ هذا الحد يحمي القاعدة من إغراق الطلبات التي تتجاوز الكاش (أفضل جهد: العدّاد لكل نسخة تشغيل).
  if (!allow(`read:${clientKey(req)}`, 120, 60_000)) return NextResponse.json({ error: "محاولات كثيرة" }, { status: 429 });
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!(PUBLIC_SETTING_KEYS as readonly string[]).includes(key)) return NextResponse.json({ error: "مفتاح غير مسموح" }, { status: 400 });
  try {
    const data = await settingDoc(key);
    return NextResponse.json({ exists: data !== null, data: data ?? {} }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ error: "تعذّر الاتصال بالقاعدة" }, { status: 502 });
  }
}
