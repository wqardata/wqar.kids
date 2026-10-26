import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9]{10,40}$/;
const JPEG_B64 = /^\/9j\/[A-Za-z0-9+/]+={0,2}$/; // يبدأ بترويسة JPEG؛ لا نخدم أي شيء آخر.

/**
 * يخدم الصورة المصغّرة المحفوظة في Firestore (thumbs/{id}) كملف JPEG حقيقي قابل للتخزين المؤقت.
 * هكذا تبقى مستندات الفيديو خفيفة، ولا تُجلب الصورة إلا عند عرضها، وتُخزَّن في CDN والمتصفح.
 * رابط الصورة في مستند الفيديو يحمل ?v=الوقت فيتغيّر عند تغيير الصورة.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!ID.test(id) || !pid) return new Response(null, { status: 404 });

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents/thumbs/${id}${key ? `?key=${encodeURIComponent(key)}` : ""}`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
    const j = (await r.json()) as { fields?: { b64?: { stringValue?: string } } };
    const b64 = j.fields?.b64?.stringValue ?? "";
    if (!JPEG_B64.test(b64)) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
    return new Response(new Uint8Array(Buffer.from(b64, "base64")), {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
