// محدّد معدّل بسيط في ذاكرة الخادم (أفضل جهد على فيرسل: كل نسخة تشغيل لها عدّادها). يخفّف الإغراق العارض ولا يغني عن حماية الشبكة.
const hits = new Map<string, number[]>();
const MAX_KEYS = 50_000; // سقف الذاكرة: عند تجاوزه تُحذف أقدم المفاتيح (أسوأ أثر: تساهل مؤقت، لا رفض خاطئ)
let lastSweep = 0;

/** true = مسموح. `max` طلبات كحد أقصى لكل `windowMs` لكل مفتاح. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.delete(key); // إعادة الإدراج تُبقي ترتيب Map من الأقدم استعمالًا إلى الأحدث
  hits.set(key, recent);
  // التنظيف مرة كل 30 ثانية على الأكثر (بدل المرور على كل المفاتيح في كل طلب حين يكبر الجدول).
  if (hits.size > 5000 && now - lastSweep > 30_000) {
    lastSweep = now;
    // أطول نافذة مستعملة ساعة؛ مفتاح لم يُستعمل منذ ساعة لا أثر له.
    for (const [k, v] of hits) if (!v.some((t) => now - t < 60 * 60_000)) hits.delete(k);
  }
  if (hits.size > MAX_KEYS) {
    for (const k of hits.keys()) {
      hits.delete(k);
      if (hits.size <= MAX_KEYS * 0.8) break;
    }
  }
  return true;
}

/** عنوان الزائر من ترويسة فيرسل (للمفاتيح فقط، لا يُخزَّن في القاعدة). */
export function clientKey(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "anon";
}
