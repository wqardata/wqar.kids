import { NextResponse, type NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { DRIVE_ID, driveThumbnail, stripExtension } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

/** يتحقق من توكن Firebase ويعيد البريد، أو null إن كان غير صالح. */
async function verifiedEmail(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!token || !projectId) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (payload.email_verified !== true || typeof payload.email !== "string") return null;
    return payload.email.toLowerCase();
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

type NameResult = { name: string | null; reason?: "private" | "unknown" };

/** المسار الأدق: Drive API (يحتاج DRIVE_API_KEY والملف مشارك للعموم). */
async function nameFromApi(id: string, key: string): Promise<NameResult | null> {
  try {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true&key=${encodeURIComponent(key)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (r.status === 404 || r.status === 403) return { name: null, reason: "private" };
    if (!r.ok) return null;
    const j = (await r.json()) as { name?: string };
    return j.name ? { name: j.name } : null;
  } catch {
    return null;
  }
}

/** بدون مفتاح: نقرأ عنوان صفحة الملف العامة. */
async function nameFromPage(id: string): Promise<NameResult> {
  try {
    const r = await fetch(`https://drive.google.com/file/d/${id}/view`, {
      headers: { "accept-language": "ar,en;q=0.8", "user-agent": "Mozilla/5.0 (compatible; VideoSite/1.0)" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    // إن كان الملف خاصًا يحوّلنا جوجل إلى صفحة تسجيل الدخول.
    if (new URL(r.url).hostname !== "drive.google.com") return { name: null, reason: "private" };
    if (r.status === 404 || r.status === 403) return { name: null, reason: "private" };
    if (!r.ok) return { name: null, reason: "unknown" };
    const html = await r.text();
    const m =
      html.match(/<meta property="og:title" content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
    if (!m) return { name: null, reason: "unknown" };
    const name = decodeEntities(m[1]).replace(/\s*-\s*Google (Drive|درايف)\s*$/i, "").trim();
    if (!name || /^(Google Drive|Sign in|Error 404)/i.test(name)) return { name: null, reason: "private" };
    return { name };
  } catch {
    return { name: null, reason: "unknown" };
  }
}

export async function GET(req: NextRequest) {
  const email = await verifiedEmail(req);
  if (!email) return NextResponse.json({ error: "غير مصرّح. سجّل الدخول أولًا." }, { status: 401 });

  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (admins.length > 0 && !admins.includes(email)) {
    return NextResponse.json({ error: "هذا الحساب غير مخوّل بإضافة فيديوهات." }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!DRIVE_ID.test(id)) return NextResponse.json({ error: "رابط درايف غير صالح." }, { status: 400 });

  const key = process.env.DRIVE_API_KEY;
  const result = (key ? await nameFromApi(id, key) : null) ?? (await nameFromPage(id));

  return NextResponse.json({
    id,
    name: result.name,
    title: result.name ? stripExtension(result.name) : null,
    thumbnail: driveThumbnail(id),
    warning:
      result.name === null
        ? result.reason === "private"
          ? "تعذّر قراءة الملف. اضبط مشاركته على «أي شخص لديه الرابط – مشاهد»."
          : "تعذّر جلب اسم الملف تلقائيًا، اكتبه يدويًا."
        : null,
  });
}
