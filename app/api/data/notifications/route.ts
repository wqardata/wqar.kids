import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { listNotices } from "@/lib/neonNotices";
import { audiencesFor, NOTICE_KEEP } from "@/lib/noticeCore";
import { allow, clientKey } from "@/lib/rateLimit";
import { adminFromToken, bearer } from "@/lib/serverAuth";
import { DEFAULT_NOTICE_COUNT } from "@/lib/settingsCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/data/notifications?n=5 → Notice[] (الأحدث أولًا).
 * الفئات يحدّدها الخادم من رمز Firebase، لا العميل (مثل firestore.rules): بلا رمز = زائر (all+guests)،
 * عضو موثّق = (all+viewers)، مشرف = (all+admins). رمز غير صالح = 401 كي لا يُعرض للمستخدم ما لا يخصّه بصمت.
 */
export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DATABASE_URL غير مضبوط" }, { status: 503 });
  if (!allow(`notices:${clientKey(req)}`, 60, 60_000)) return NextResponse.json({ error: "محاولات كثيرة" }, { status: 429 });
  const n = Math.min(NOTICE_KEEP, Math.max(1, Math.floor(Number(new URL(req.url).searchParams.get("n"))) || DEFAULT_NOTICE_COUNT));
  const token = bearer(req);
  let auds = audiencesFor(null, false);
  if (token) {
    const a = await adminFromToken(token);
    if ("email" in a) auds = audiencesFor("member", true);
    else if (a.error === "forbidden") auds = audiencesFor("member", false);
    else return NextResponse.json({ error: "يلزم تسجيل الدخول" }, { status: 401 });
  }
  try {
    return NextResponse.json(await listNotices(auds, n), {
      headers: { "Cache-Control": token ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=60", Vary: "Authorization" },
    });
  } catch {
    return NextResponse.json({ error: "تعذّر الاتصال بالقاعدة" }, { status: 502 });
  }
}
