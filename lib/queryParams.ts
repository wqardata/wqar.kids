// حماية كاش CDN: كاش فيرسل يعتمد على الرابط كاملًا، فمعامل وهمي (?all=1&x=123) يتجاوز الكاش ويوقظ القاعدة في كل طلب.
// لذلك ترفض مسارات القراءة العامة أي معامل غير معروف أو مكرّر. دالة خالصة بلا شبكة.

/** true إن كانت كل المعاملات ضمن `allowed` ولم يتكرّر أيٌّ منها. */
export function onlyParams(p: URLSearchParams, allowed: readonly string[]): boolean {
  const seen = new Set<string>();
  for (const k of p.keys()) {
    if (!allowed.includes(k) || seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/** قيم ?latest= المسموحة (ما تطلبه الواجهة فعلًا: معاينة اللوحة 12، المقترحات 50/200، القوائم 200، المقاطع القصيرة 200). */
export const LATEST_ALLOWED: readonly number[] = [12, 20, 50, 100, 200, 500, 1000];
