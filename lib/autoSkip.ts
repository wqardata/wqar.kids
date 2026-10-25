"use client";
// يكشف تلقائيًا مدة الإعلان والمقدمة لفيديو، بمقارنته بحلقات مجموعته وبفيديوهات من مجموعات أخرى.
import type { User } from "firebase/auth";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { getDb } from "./firebase";
import { loadFingerprint, saveFingerprint } from "./fingerprints";
import { detectSkip, type Fingerprint, type SkipResult } from "./introDetect";
import { sampleFingerprint } from "./introSample";
import { compareInSeries, toVideo, type VideoDoc } from "./videos";

const SAME_REFS = 3;
const OTHER_REFS = 2;

export type AutoSkipResult =
  | ({ status: "ok"; sameRefs: number; otherRefs: number } & SkipResult)
  | { status: "no-refs" } // لا فيديوهات أخرى للمقارنة بعد
  | { status: "error"; message: string };

const usable = (v: VideoDoc) => Boolean(v.driveId) && !v.clip;

/** بصمة الفيديو: من التخزين إن وُجدت وإلا تُحسب (وتُحفظ). null إن تعذّر الفتح. */
async function fingerprintOf(v: VideoDoc, user: User, signal: AbortSignal | undefined, onStep?: (t: string) => void): Promise<Fingerprint | null> {
  const cached = await loadFingerprint(v.id, v.driveId);
  if (cached) return cached;
  onStep?.(`تحليل «${v.title}»…`);
  try {
    const token = await user.getIdToken();
    const { fp } = await sampleFingerprint(`/api/drive-video?id=${encodeURIComponent(v.driveId)}&token=${encodeURIComponent(token)}`, { signal });
    await saveFingerprint(v.id, v.driveId, fp);
    return fp;
  } catch {
    if (signal?.aborted) throw new Error("aborted");
    return null;
  }
}

/** المراجع: حلقات من المجموعة نفسها (الأقرب ترتيبًا أولًا) + فيديوهات من مجموعات مختلفة. */
async function pickRefs(video: VideoDoc): Promise<{ same: VideoDoc[]; other: VideoDoc[] }> {
  const db = getDb();
  let same: VideoDoc[] = [];
  if (video.seriesId) {
    const snap = await getDocs(query(collection(db, "videos"), where("seriesId", "==", video.seriesId), limit(40)));
    const all = snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => v.id !== video.id && usable(v) && v.driveId !== video.driveId).sort(compareInSeries);
    const at = all.findIndex((v) => compareInSeries(v, video) > 0);
    const pivot = at < 0 ? all.length : at;
    // الأقرب إلى الفيديو في الترتيب أولًا (الجار قبله ثم بعده …).
    const near: VideoDoc[] = [];
    for (let k = 0; near.length < SAME_REFS && (pivot - 1 - k >= 0 || pivot + k < all.length); k++) {
      if (all[pivot - 1 - k]) near.push(all[pivot - 1 - k]);
      if (near.length < SAME_REFS && all[pivot + k]) near.push(all[pivot + k]);
    }
    same = near;
  }
  const snap = await getDocs(query(collection(db, "videos"), orderBy("createdAt", "desc"), limit(60)));
  const seen = new Set<string>();
  const other: VideoDoc[] = [];
  for (const d of snap.docs) {
    const v = toVideo(d.id, d.data());
    if (!usable(v) || v.driveId === video.driveId) continue;
    if (video.seriesId ? v.seriesId === video.seriesId : false) continue;
    const key = v.seriesId || `solo:${v.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    other.push(v);
    if (other.length >= OTHER_REFS) break;
  }
  return { same, other };
}

/**
 * يحلّل الفيديو ويعيد مدة الإعلان والمقدمة. لا يكتب شيئًا على الفيديو نفسه (يُترك للمستدعي).
 * يحتاج مشرفًا (يقرأ /api/drive-video ويكتب fingerprints).
 */
export async function autoDetectSkip(video: VideoDoc, user: User, opts: { signal?: AbortSignal; onStep?: (t: string) => void } = {}): Promise<AutoSkipResult> {
  try {
    if (!video.driveId) return { status: "error", message: "لا يوجد ملف درايف لهذا الفيديو." };
    opts.onStep?.("البحث عن فيديوهات للمقارنة…");
    const refs = await pickRefs(video);
    if (refs.same.length + refs.other.length === 0) return { status: "no-refs" };
    const target = await fingerprintOf(video, user, opts.signal, opts.onStep);
    if (!target) return { status: "error", message: "تعذّر قراءة الفيديو (تأكد أن مشاركته «أي شخص لديه الرابط» وأن صيغته يدعمها المتصفح)." };
    const sameFp: Fingerprint[] = [], otherFp: Fingerprint[] = [];
    for (const v of refs.same) {
      const f = await fingerprintOf(v, user, opts.signal, opts.onStep);
      if (f) sameFp.push(f);
    }
    for (const v of refs.other) {
      const f = await fingerprintOf(v, user, opts.signal, opts.onStep);
      if (f) otherFp.push(f);
    }
    if (sameFp.length + otherFp.length === 0) return { status: "error", message: "تعذّر قراءة الفيديوهات المرجعية." };
    opts.onStep?.("مقارنة اللقطات…");
    return { status: "ok", sameRefs: sameFp.length, otherRefs: otherFp.length, ...detectSkip(target, sameFp, otherFp) };
  } catch (e) {
    if (e instanceof Error && e.message === "aborted") return { status: "error", message: "أُلغي الكشف." };
    return { status: "error", message: "تعذّر الكشف التلقائي. حدّث قواعد Firestore (fingerprints) وتأكد من قراءة الفيديو." };
  }
}
