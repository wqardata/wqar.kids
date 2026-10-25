import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "./firebase";

/** رابط الصورة المصغّرة المخدومة من /api/thumb. `v` يغيّر الرابط عند تغيير الصورة فيتحدّث التخزين المؤقت. */
export function thumbUrl(videoId: string, v: number = Date.now()): string {
  return `/api/thumb/${videoId}?v=${v}`;
}

/** يحفظ لقطة JPEG (data URL) في thumbs/{videoId} ويعيد رابطها. */
export async function saveThumb(videoId: string, dataUrl: string): Promise<string> {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("صيغة الصورة غير صالحة.");
  await setDoc(doc(getDb(), "thumbs", videoId), { b64: m[1], createdAt: serverTimestamp() });
  return thumbUrl(videoId);
}

/** يحذف الصورة المحفوظة (إن وُجدت). لا يرمي خطأ لأن غيابها لا يضرّ. */
export async function deleteThumb(videoId: string): Promise<void> {
  try {
    await deleteDoc(doc(getDb(), "thumbs", videoId));
  } catch {
    /* تجاهل */
  }
}

/**
 * يحوّل ملف صورة من الجهاز إلى JPEG مصغَّر (أطول ضلع 640) كـ data URL، بحجم يناسب مستند Firestore.
 * يرمي خطأً برسالة عربية إن لم يكن الملف صورة صالحة.
 */
export async function fileToJpegDataUrl(file: File, longEdge = 640): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("اختر ملف صورة (JPG أو PNG أو WebP).");
  if (file.size > 15 * 1024 * 1024) throw new Error("حجم الصورة كبير جدًا (الحد 15 ميغابايت).");
  let w = 0;
  let h = 0;
  let src: CanvasImageSource;
  try {
    const bmp = await createImageBitmap(file);
    w = bmp.width;
    h = bmp.height;
    src = bmp;
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error("تعذّر قراءة الصورة."));
        im.src = url;
      });
      w = img.naturalWidth;
      h = img.naturalHeight;
      src = img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!w || !h) throw new Error("تعذّر قراءة الصورة.");
  const k = Math.min(1, longEdge / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("المتصفح لا يدعم معالجة الصور.");
  ctx.fillStyle = "#fff"; // الصور الشفافة (PNG) تُرسم على خلفية بيضاء لأن JPEG بلا شفافية
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  let out = "";
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    out = c.toDataURL("image/jpeg", q);
    if (out.length <= 200_000) return out;
  }
  throw new Error("الصورة معقّدة جدًا بعد التصغير؛ جرّب صورة أبسط.");
}
