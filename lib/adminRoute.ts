// مساعد مشترك لمسارات /api/admin/*: قاعدة مضبوطة + رمز Firebase صالح + مشرف + حد معدّل. للخادم فقط.
import { NextResponse } from "next/server";
import { isDbConfigured } from "./db";
import { allow } from "./rateLimit";
import { adminFromToken, bearer } from "./serverAuth";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
export const bad = () => fail("طلب غير صالح", 400);
export const notFound = () => fail("غير موجود", 404);
export const dbDown = () => fail("تعذّر الاتصال بالقاعدة", 502);

/** يعيد استجابة خطأ جاهزة إن لم يكن الطلب من مشرف، وإلا {email}. */
export async function requireAdmin(req: Request): Promise<{ email: string } | NextResponse> {
  if (!isDbConfigured()) return fail("DATABASE_URL غير مضبوط", 503);
  const a = await adminFromToken(bearer(req));
  if ("error" in a) return a.error === "unauthorized" ? fail("يلزم تسجيل الدخول", 401) : fail("غير مصرّح", 403);
  if (!allow(`admin:${a.email}`, 240, 60_000)) return fail("محاولات كثيرة", 429);
  return a;
}
