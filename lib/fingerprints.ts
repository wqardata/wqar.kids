// تخزين «بصمات» الفيديوهات (fingerprints/{videoId}) كي لا تُحسب من جديد؛ للمشرف فقط (قواعد Firestore).
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "./firebase";
import { decodeFingerprint, encodeFingerprint, type Fingerprint } from "./introDetect";

/** بصمة محفوظة لهذا الفيديو (وبنفس ملف درايف)، أو null. */
export async function loadFingerprint(videoId: string, driveId: string): Promise<Fingerprint | null> {
  try {
    const s = await getDoc(doc(getDb(), "fingerprints", videoId));
    if (!s.exists()) return null;
    const d = s.data();
    if (d.driveId !== driveId || typeof d.fp !== "string" || typeof d.step !== "number") return null;
    return decodeFingerprint(d.fp, d.step);
  } catch {
    return null;
  }
}

export async function saveFingerprint(videoId: string, driveId: string, fp: Fingerprint): Promise<void> {
  try {
    await setDoc(doc(getDb(), "fingerprints", videoId), { fp: encodeFingerprint(fp), step: fp.step, n: fp.n, driveId, createdAt: serverTimestamp() });
  } catch {
    /* القواعد القديمة: نكمل بلا تخزين مؤقت */
  }
}

export async function deleteFingerprint(videoId: string): Promise<void> {
  try {
    await deleteDoc(doc(getDb(), "fingerprints", videoId));
  } catch {
    /* تجاهل */
  }
}
