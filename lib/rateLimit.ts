// محدّد معدّل بسيط في ذاكرة الخادم (أفضل جهد على فيرسل: كل نسخة تشغيل لها عدّادها). يخفّف الإغراق العارض ولا يغني عن حماية الشبكة.
const hits = new Map<string, number[]>();

/** true = مسموح. `max` طلبات كحد أقصى لكل `windowMs` لكل مفتاح. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}

/** عنوان الزائر من ترويسة فيرسل (للمفاتيح فقط، لا يُخزَّن في القاعدة). */
export function clientKey(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "anon";
}
