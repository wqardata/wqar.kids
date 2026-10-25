import { NextResponse, type NextRequest } from "next/server";

function sources(id: string): string[] {
  const list: string[] = [];
  const key = process.env.DRIVE_API_KEY;
  if (key) list.push(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(key)}`);
  // بدون مفتاح (أو إن رفضه درايف): رابط التنزيل العام؛ confirm=t يتجاوز صفحة «لا يمكن فحص الملف» للملفات الكبيرة.
  list.push(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`);
  return list;
}

/** أقصى حجم يُمرَّر في استجابة واحدة (بايت). المتصفح يطلب الباقي على دفعات عند الحاجة فقط،
 *  فلا يُسحب الفيديو كاملًا عبر فيرسل (كل بايت يمرّ من هنا يُحتسب في Fast Origin Transfer). */
const MAX_CHUNK = 6 * 1024 * 1024;

/** يقصّ ترويسة Range بحيث لا يتجاوز الطلب MAX_CHUNK. بلا Range يُعامَل الطلب كأنه bytes=0-. */
function clampRange(range: string | null): string {
  const m = /^bytes=(\d*)-(\d*)$/.exec((range ?? "").trim());
  if (!m || (m[1] === "" && m[2] === "")) return `bytes=0-${MAX_CHUNK - 1}`;
  if (m[1] === "") return `bytes=-${Math.min(Number(m[2]), MAX_CHUNK)}`; // آخر N بايت
  const start = Number(m[1]);
  const end = m[2] === "" ? Infinity : Number(m[2]);
  return `bytes=${start}-${Math.min(end, start + MAX_CHUNK - 1)}`;
}

export function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

/** يمرّر بايتات ملف درايف (مع دعم Range) أو يعيد خطأ JSON. */
export async function streamDrive(req: NextRequest, id: string, cacheControl = "private, no-store"): Promise<Response> {
  const range = clampRange(req.headers.get("range"));
  let lastStatus = 502;
  for (const url of sources(id)) {
    let up: Response;
    try {
      up = await fetch(url, {
        headers: { range },
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
      "cache-control": cacheControl,
    });
    const len = up.headers.get("content-length");
    const cr = up.headers.get("content-range");
    if (len && !up.headers.get("content-encoding")) headers.set("content-length", len);
    if (cr) headers.set("content-range", cr);
    return new Response(up.body, { status: up.status, headers });
  }
  return fail(lastStatus === 404 || lastStatus === 403 ? 404 : 502, "تعذّر قراءة الفيديو من درايف. تأكد أن مشاركته «أي شخص لديه الرابط – مشاهد».");
}
