import type { NextRequest } from "next/server";
import { getServerSettings } from "@/lib/serverSettings";

export const runtime = "nodejs";

const RE = /^data:(image\/(?:png|webp|jpeg));base64,([A-Za-z0-9+/=]+)$/;

/** يخدم شعار الموقع كملف صورة (أيقونة التبويب)، وإن لم يوجد شعار يحوّل إلى الأيقونة الافتراضية. */
export async function GET(req: NextRequest) {
  const { logo } = await getServerSettings();
  const m = RE.exec(logo);
  if (!m) return Response.redirect(new URL("/icons/icon-192.png", req.url), 307);
  const hasV = req.nextUrl.searchParams.has("v");
  return new Response(new Uint8Array(Buffer.from(m[2], "base64")), {
    headers: {
      "content-type": m[1],
      // الرابط يحمل ?v=بصمة الشعار فيتغيّر عند تغيير الشعار، فيمكن تخزينه طويلًا.
      "cache-control": hasV ? "public, max-age=31536000, s-maxage=31536000, immutable" : "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
