// الجزء النقي من الصور المصغّرة (بلا React ولا Firebase ولا قاعدة) ليعمل في المتصفح والخادم والاختبارات.

/** معرّف الفيديو/المجموعة المسموح به لصورة مصغّرة (بشكل معرّفات Firestore وnewId). */
export const THUMB_ID = /^[A-Za-z0-9]{10,40}$/;
/** نص base64 لملف JPEG حقيقي (يبدأ بترويسة JPEG)؛ لا نخدم أو نحفظ أي شيء آخر. */
export const JPEG_B64 = /^\/9j\/[A-Za-z0-9+/]+={0,2}$/;
/** نفس حد firestore.rules: أقل من 300000 حرف. */
export const MAX_B64 = 299_999;
export const MAX_THUMB_DELETE = 1000;

/** يستخرج base64 من data URL لصورة JPEG، أو null إن لم تكن بهذه الصيغة. */
export function parseJpegDataUrl(dataUrl: string): string | null {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? m[1] : null;
}

/** base64 صالح للحفظ: JPEG وبحجم ضمن الحد. */
export const isSavableB64 = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_B64 && JPEG_B64.test(v);
