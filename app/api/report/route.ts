import { NextResponse, type NextRequest } from "next/server";
import { fsCreate, fsGet, serviceAccountConfigured } from "@/lib/serverFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// حدّ بسيط لمنع الإغراق (5 بلاغات / 10 دقائق لكل عنوان). في الذاكرة: يكفي كحاجز أول على الاستضافة السحابية.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 5) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

const err = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });

/**
 * استقبال بلاغ من أي زائر (بلا تسجيل دخول) وحفظه في Firestore عبر حساب الخدمة، فلا تتدخل قواعد Firestore.
 * 501 = لم يُضبط FIREBASE_SERVICE_ACCOUNT، فيعود المتصفح للكتابة المباشرة (تتطلب القواعد).
 */
export async function POST(req: NextRequest) {
  if (!serviceAccountConfigured()) return err(501, "not-configured");
  let body: { videoId?: unknown; reason?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return err(400, "طلب غير صالح.");
  }
  const videoId = typeof body.videoId === "string" ? body.videoId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 80) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (!/^[A-Za-z0-9]{10,40}$/.test(videoId) || !reason) return err(400, "بيانات البلاغ غير صالحة.");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return err(429, "أرسلتَ بلاغات كثيرة. حاول لاحقًا.");

  try {
    // العنوان يُؤخذ من الخادم لا من المتصفح، ولا يُقبل بلاغ عن فيديو غير موجود.
    const video = await fsGet("videos", videoId);
    if (!video) return err(404, "الفيديو غير موجود.");
    const title = typeof video.data.title === "string" ? video.data.title.slice(0, 200) : "";
    await fsCreate("reports", { videoId, videoTitle: title, reason, note, status: "open", createdAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("report failed", e);
    return err(502, "تعذّر حفظ البلاغ على الخادم. تحقق من FIREBASE_SERVICE_ACCOUNT.");
  }
}
