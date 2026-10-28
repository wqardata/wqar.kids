import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { addReport } from "@/lib/neonWrites";
import { allow, clientKey } from "@/lib/rateLimit";
import { cleanReport } from "@/lib/visitorInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/data/report {videoId, videoTitle, reason, note} — بلاغ من أي زائر (بدون تسجيل دخول)، بالحدود نفسها التي كانت في firestore.rules. */
export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "DATABASE_URL غير مضبوط" }, { status: 503 });
  if (!allow(`report:${clientKey(req)}`, 5, 10 * 60_000)) return NextResponse.json({ error: "محاولات كثيرة، حاول لاحقًا" }, { status: 429 });
  const r = cleanReport(await req.json().catch(() => null));
  if (!r) return NextResponse.json({ error: "بلاغ غير صالح" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, id: await addReport(r) });
  } catch {
    return NextResponse.json({ error: "تعذّر الاتصال بالقاعدة" }, { status: 502 });
  }
}
