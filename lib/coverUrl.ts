// دوال خالصة بلا اعتماديات: تُستعمل في المتصفح وفي مسارات الخادم (لا يصح استيرادها من ملف "use client" إلى الخادم).

/** رابط صورة مخصّصة صالح للعرض: داخلي (/api/thumb/…) أو https من درايف/جوجل فقط. */
export function cleanCoverImage(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  if (/^\/api\/thumb\/[A-Za-z0-9]{10,40}(\?v=\d+)?$/.test(t)) return t;
  if (/^https:\/\/(drive\.google\.com|lh\d\.googleusercontent\.com|drive\.usercontent\.google\.com)\//.test(t) && t.length <= 500) return t;
  return "";
}

/** رابط صورة جاهز محفوظ في مستند المجموعة (avatarUrl): داخلي أو https فقط. */
export function cleanAvatarUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length <= 600 && /^(\/(?!\/)|https:\/\/)/.test(t) ? t : "";
}
