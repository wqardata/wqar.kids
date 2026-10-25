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
