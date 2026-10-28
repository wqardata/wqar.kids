import type { NextRequest } from "next/server";
import { DRIVE_ID } from "@/lib/drive";
import { fail, streamDrive } from "@/lib/driveStream";
import { allow, clientKey } from "@/lib/rateLimit";
import { adminFromToken } from "@/lib/serverAuth";
import { getServerSettings } from "@/lib/serverSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * مسار احتياطي لصوت الأذكار: المتصفح يجرّب أولًا الرابط المباشر من درايف، وإن فشل يطلب الملف من هنا.
 * لا يخدم إلا ملفات صوت حفظها المشرف فعلًا في إعدادات الأذكار (وليس أي ملف درايف)، وصيغ صوتية فقط.
 * استثناء: المشرف (توكن ?token=) يجرّب أي ملف قبل الحفظ.
 */
export async function GET(req: NextRequest) {
  // مفعّل افتراضيًا؛ يُعطَّل بـ NEXT_PUBLIC_ADHKAR_AUDIO_PROXY=0.
  if (process.env.NEXT_PUBLIC_ADHKAR_AUDIO_PROXY === "0") return fail(404, "غير مفعّل.");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!DRIVE_ID.test(id)) return fail(400, "معرّف درايف غير صالح.");
  const token = req.nextUrl.searchParams.get("token");
  const isAdmin = token ? !("error" in (await adminFromToken(token))) : false;
  if (!isAdmin) {
    // كل طلب يمرّر حتى 6MB عبر فيرسل: نحدّ عدد طلبات الزائر الواحد (أفضل جهد).
    if (!allow(`audio:${clientKey(req)}`, 30, 60_000)) return fail(429, "محاولات كثيرة.");
    const { adhkar } = await getServerSettings();
    const allowed =
      [...adhkar.morning, ...adhkar.evening].some((x) => x.audio === id) ||
      false;
    if (!allowed) return fail(404, "ملف غير معروف.");
  }
  return streamDrive(req, id, "private, max-age=3600", { fallbackType: "audio/mpeg", audioOnly: true });
}
