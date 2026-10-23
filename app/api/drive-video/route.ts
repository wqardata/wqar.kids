import { NextResponse, type NextRequest } from "next/server";
import { DRIVE_ID } from "@/lib/drive";
import { bearer, emailFromToken, isAdminEmail } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * وسيط يمرّر بايتات فيديو درايف إلى متصفح المشرف من نفس نطاق الموقع.
 * الغرض الوحيد: التقاط لقطة (canvas) من الفيديو؛ المتصفح يمنع قراءة بكسلات فيديو من نطاق آخر.
 * يدعم Range فيطلب المتصفح الأجزاء اللازمة فقط (لا يُنزَّل الفيديو كله).
 * محصور بالمشرفين. <video> لا يرسل ترويسات مخصصة، فيُقبل التوكن في ?token= (صلاحيته ساعة ويُستعمل لطلبك أنت فقط).
 */
function sources(id: string): string[] {
  const list: string[] = [];
  const key = process.env.DRIVE_API_KEY;
  if (key) list.push(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(key)}`);
  // بدون مفتاح (أو إن رفضه درايف): رابط التنزيل العام؛ confirm=t يتجاوز صفحة «لا يمكن فحص الملف» للملفات الكبيرة.
  list.push(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`);
  return list;
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || bearer(req);
  const email = await emailFromToken(token);
  if (!email) return fail(401, "غير مصرّح.");
  if (!isAdminEmail(email)) return fail(403, "هذا الحساب غير مخوّل.");

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!DRIVE_ID.test(id)) return fail(400, "معرّف درايف غير صالح.");

  const range = req.headers.get("range");
  let lastStatus = 502;
  for (const url of sources(id)) {
    let up: Response;
    try {
      up = await fetch(url, {
        headers: range ? { range } : {},
        redirect: "follow",
        cache: "no-store",
        signal: req.signal,
      });
    } catch {
      continue;
    }
    lastStatus = up.status;
    const type = (up.headers.get("content-type") ?? "").toLowerCase();
    // 200/206 = بيانات، 416 = نطاق غير مُرضٍ (يُمرَّر كما هو). صفحات HTML/JSON تعني خطأ أو ملفًا خاصًا.
    const isData = (up.status === 200 || up.status === 206) && !type.startsWith("text/") && !type.includes("json");
    if (!isData && up.status !== 416) {
      up.body?.cancel().catch(() => {});
      continue;
    }

    const headers = new Headers({
      "content-type": !type || type.startsWith("application/octet-stream") ? "video/mp4" : type,
      "accept-ranges": "bytes",
      "cache-control": "private, no-store",
    });
    const len = up.headers.get("content-length");
    const cr = up.headers.get("content-range");
    if (len && !up.headers.get("content-encoding")) headers.set("content-length", len);
    if (cr) headers.set("content-range", cr);
    return new Response(up.body, { status: up.status, headers });
  }
  return fail(lastStatus === 404 || lastStatus === 403 ? 404 : 502, "تعذّر قراءة الفيديو من درايف. تأكد أن مشاركته «أي شخص لديه الرابط – مشاهد».");
}
