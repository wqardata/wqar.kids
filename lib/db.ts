// الاتصال بقاعدة Neon (Postgres). للاستعمال على الخادم فقط (مسارات API وكود الخادم): لا تستورده من مكوّن "use client".
// المتغير DATABASE_URL يُضبط في إعدادات Vercel (Environment Variables) ولا يُرفع إلى المستودع أبدًا.
import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

/** هل ضُبط اتصال Neon؟ (يسمح بإبقاء Firestore هو الافتراضي حتى يكتمل الانتقال.) */
export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير مضبوط");
  return (client ??= neon(url));
}

/** استعلام بمعاملات: query("select * from videos where id = $1", [id]). القيم لا تُدمج في النص أبدًا (حماية من حقن SQL). */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await sql().query(text, params)) as T[];
}

/** أول صف أو null. */
export async function queryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}
