"use client";
import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, doc, documentId, getDocs, increment, limit, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";

export type Named = { id: string; name: string; /** فيديو الغلاف المختار للسلسلة (فارغ = تلقائي). */ coverVideoId?: string };

export type VideoDoc = {
  id: string;
  title: string;
  driveId: string;
  thumbnail: string;
  description: string;
  categoryId: string;
  categoryName: string;
  seriesId: string;
  seriesName: string;
  season: number | null;
  episode: number | null;
  isShort: boolean;
  hidden: boolean;
  /** مدة الفيديو بالثواني (null = غير معروفة). */
  duration: number | null;
  /** عدد المشاهدات (يزيد مرة لكل زائر في كل جلسة). */
  views: number;
  createdAt: number | null;
};

function norm(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** قائمة مسمّاة (تصنيفات/سلاسل) مع إمكانية إضافة عنصر جديد. */
export function useNamedList(coll: "categories" | "series") {
  const [items, setItems] = useState<Named[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDocs(query(collection(getDb(), coll), orderBy("name")))
      .then((snap) => {
        if (!off) setItems(snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? ""), coverVideoId: typeof d.data().coverVideoId === "string" ? (d.data().coverVideoId as string) : "" })));
      })
      .catch(() => {
        if (!off) setError("تعذّر تحميل القائمة.");
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [coll]);

  /** يضيف عنصرًا جديدًا ويعيد معرّفه (أو معرّف العنصر الموجود بنفس الاسم). */
  const create = useCallback(
    async (rawName: string): Promise<string> => {
      const name = rawName.trim().replace(/\s+/g, " ");
      if (!name) throw new Error("اكتب الاسم أولًا.");
      const existing = items.find((i) => norm(i.name) === norm(name));
      if (existing) return existing.id;
      const ref = await addDoc(collection(getDb(), coll), { name, createdAt: serverTimestamp() });
      setItems((prev) => [...prev, { id: ref.id, name }].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      return ref.id;
    },
    [coll, items],
  );

  return { items, loading, error, create };
}

function ts(v: unknown): number | null {
  const t = v as { toMillis?: () => number } | null;
  return t && typeof t.toMillis === "function" ? t.toMillis() : null;
}

export function toVideo(id: string, d: Record<string, unknown>): VideoDoc {
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const n = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : null);
  return {
    id,
    title: s("title"),
    driveId: s("driveId"),
    thumbnail: s("thumbnail"),
    description: s("description"),
    categoryId: s("categoryId"),
    categoryName: s("categoryName"),
    seriesId: s("seriesId"),
    seriesName: s("seriesName"),
    season: n("season"),
    episode: n("episode"),
    isShort: d.isShort === true,
    hidden: d.hidden === true,
    duration: typeof d.duration === "number" && d.duration > 0 ? Math.round(d.duration) : null,
    views: typeof d.views === "number" && d.views > 0 ? Math.floor(d.views) : 0,
    createdAt: ts(d.createdAt),
  };
}

/** يزيد عدّاد مشاهدات الفيديو مرة واحدة لكل جلسة متصفح. الفشل صامت (لا يمنع المشاهدة). */
export async function countView(id: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    const k = `viewed:${id}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
    await updateDoc(doc(getDb(), "videos", id), { views: increment(1) });
  } catch {
    /* القواعد القديمة أو التخزين غير متاح: نتجاهل */
  }
}

/** تطبيع عربي خفيف للبحث: يزيل التشكيل ويوحّد الألف والياء والتاء المربوطة. */
export function normalizeAr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

/** أحدث الفيديوهات الظاهرة للزوار (غير المخفية)، حتى 200. */
export function useAllVideos() {
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(200)))
      .then((snap) => !off && setVideos(snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => !v.hidden)))
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, []);
  return { videos, ready };
}

/**
 * يجلب فيديوهات بمعرّفاتها (للسجل). يحافظ على ترتيب المعرّفات ويتجاهل المحذوف والمخفي.
 * Firestore يحدّ استعلام «in» بـ 30 معرّفًا، فنقسّم على دفعات.
 */
export function useVideosByIds(ids: readonly string[]) {
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const key = ids.join(",");
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    if (!key) {
      setVideos([]);
      setReady(true);
      return;
    }
    let off = false;
    const list = key.split(",");
    const chunks: string[][] = [];
    for (let i = 0; i < list.length; i += 30) chunks.push(list.slice(i, i + 30));
    Promise.all(chunks.map((c) => getDocs(query(collection(getDb(), "videos"), where(documentId(), "in", c)))))
      .then((snaps) => {
        if (off) return;
        const byId = new Map<string, VideoDoc>();
        for (const s of snaps) for (const d of s.docs) byId.set(d.id, toVideo(d.id, d.data()));
        setVideos(list.map((id) => byId.get(id)).filter((v): v is VideoDoc => Boolean(v) && !v!.hidden));
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, [key]);
  return { videos, ready };
}

/** صورة المجموعة: الفيديو الذي اختاره المشرف، وإلا الأكثر مشاهدة (ثم الأحدث). تتجاهل المخفي. */
export function pickCover(list: readonly VideoDoc[], coverId = ""): VideoDoc | undefined {
  const usable = list.filter((v) => !v.hidden);
  return usable.find((v) => v.id === coverId) ?? [...usable].sort((a, b) => b.views - a.views || (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
}
