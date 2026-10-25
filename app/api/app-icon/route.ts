import { NextResponse, type NextRequest } from "next/server";
import { SETTINGS_TAG } from "@/lib/serverSettings";

export const runtime = "nodejs";

/**
 * يخدم أيقونة التطبيق التي رفعها المشرف (PNG محفوظ في Firestore: settings/appicon).
 * s=192|512 ، وv رقم النسخة لتجديد التخزين المؤقت. إن لم توجد أيقونة نُحوّل للأيقونة الافتراضية.
 */
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s") === "512" ? "512" : "192";
  const fallback = () => NextResponse.redirect(new URL(`/icons/icon-${s}.png`, req.url), 302);
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!pid) return fallback();
  try {
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents/settings/appicon${key ? `?key=${encodeURIComponent(key)}` : ""}`,
      { next: { revalidate: 300, tags: [SETTINGS_TAG] }, signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) return fallback();
    const j = (await r.json()) as { fields?: Record<string, { stringValue?: string }> };
    const data = j.fields?.[`png${s}`]?.stringValue ?? "";
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(data);
    if (!m) return fallback();
    const hasV = req.nextUrl.searchParams.has("v");
    return new NextResponse(Buffer.from(m[1], "base64"), {
      headers: {
        "content-type": "image/png",
        "cache-control": hasV ? "public, max-age=31536000, immutable" : "public, max-age=300",
      },
    });
  } catch {
    return fallback();
  }
}
