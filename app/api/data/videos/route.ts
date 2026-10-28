import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { allow, clientKey } from "@/lib/rateLimit";
import { MAX_IDS, allVideos, latestVideos, videosBy, videosByIds } from "@/lib/neonServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// قراءة عامة (كانت قواعد Firestore تسمح بها لكل أحد). كاش قصير على شبكة فيرسل يخفّف الحمل عن Neon.
const CACHE = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * GET /api/data/videos
 *   ?latest=200        أحدث N فيديو ظاهر
 *   ?all=1             كل الفيديوهات الظاهرة
 *   ?categoryId=… | ?seriesId=…   فيديوهات تصنيف/مجموعة (الظاهرة)
 *   ?ids=a,b,c         فيديوهات بمعرّفاتها (يشمل المخفي كما كان Firestore؛ الواجهة تقرّر)
 */
export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DATABASE_URL غير مضبوط" }, { status: 503 });
  // الطلبات التي تُخدم من كاش CDN لا تصل هنا؛ هذا الحد يحمي القاعدة من إغراق الطلبات التي تتجاوز الكاش (أفضل جهد: العدّاد لكل نسخة تشغيل).
  if (!allow(`read:${clientKey(req)}`, 120, 60_000)) return NextResponse.json({ error: "محاولات كثيرة" }, { status: 429 });
  const p = new URL(req.url).searchParams;
  try {
    const ids = p.get("ids");
    if (ids !== null) {
      const list = ids.split(",").filter(Boolean);
      if (list.length > MAX_IDS || list.some((i) => !ID.test(i))) return NextResponse.json({ error: "معرّفات غير صالحة" }, { status: 400 });
      return NextResponse.json(await videosByIds(list), { headers: CACHE });
    }
    const cat = p.get("categoryId");
    if (cat !== null) return ID.test(cat) ? NextResponse.json(await videosBy("category_id", cat), { headers: CACHE }) : NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    const ser = p.get("seriesId");
    if (ser !== null) return ID.test(ser) ? NextResponse.json(await videosBy("series_id", ser), { headers: CACHE }) : NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    const latest = p.get("latest");
    if (latest !== null) {
      const n = Number(latest);
      return Number.isInteger(n) && n > 0 ? NextResponse.json(await latestVideos(n), { headers: CACHE }) : NextResponse.json({ error: "عدد غير صالح" }, { status: 400 });
    }
    if (p.get("all") === "1") return NextResponse.json(await allVideos(), { headers: CACHE });
    return NextResponse.json({ error: "معامل ناقص" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "تعذّر الاتصال بالقاعدة" }, { status: 502 });
  }
}
