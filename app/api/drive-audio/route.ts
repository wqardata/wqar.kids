import type { NextRequest } from "next/server";
import { DRIVE_ID } from "@/lib/drive";
import { fail, streamDrive } from "@/lib/driveStream";
import { getServerSettings } from "@/lib/serverSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * مسار احتياطي لصوت الأذكار: المتصفح يجرّب أولًا الرابط المباشر من درايف، وإن فشل يطلب الملف من هنا.
 * لا يخدم إلا ملفات صوت حفظها المشرف فعلًا في إعدادات الأذكار (وليس أي ملف درايف)، وصيغ صوتية فقط.
 */
export async function GET(req: NextRequest) {
  // معطّل افتراضيًا: يستهلك نقل بيانات فيرسل. يُفعَّل بـ NEXT_PUBLIC_ADHKAR_AUDIO_PROXY=1.
  if (process.env.NEXT_PUBLIC_ADHKAR_AUDIO_PROXY !== "1") return fail(404, "غير مفعّل.");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!DRIVE_ID.test(id)) return fail(400, "معرّف درايف غير صالح.");
  const { adhkar } = await getServerSettings();
  const allowed = [...adhkar.morning, ...adhkar.evening].some((x) => x.audio === id);
  if (!allowed) return fail(404, "ملف غير معروف.");
  return streamDrive(req, id, "private, max-age=3600", { fallbackType: "audio/mpeg", audioOnly: true });
}
