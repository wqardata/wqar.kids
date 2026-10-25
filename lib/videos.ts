"use client";
import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, doc, documentId, getDocs, increment, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where, type QueryDocumentSnapshot } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";

export type Named = { id: string; name: string; /** فيديو الغلاف المختار للمجموعة (فارغ = تلقائي). */ coverVideoId?: string };

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
  /** مقطع مقتطع قديم (clipStart/clipEnd): أُلغيت خاصية الاقتصاص، فيُخفى عن الزوار ويبقى في لوحة التحكم لتحذفه. */
  clip: boolean;
  /** ثوانٍ: نهاية المقدمة/الإعلان داخل الفيديو (= adSec + introSec). إن وُجدت يظهر زر «تخطي» في بداية التشغيل (null = بلا زر). */
  skipTo: number | null;
  /** مدة الإعلان في بداية الفيديو بالثواني (null = لا إعلان/غير معروفة). */
  adSec: number | null;
  /** مدة المقدمة (بعد الإعلان) بالثواني (null = لا مقدمة/غير معروفة). */
  introSec: number | null;
  /** تم فحص الفيديو تلقائيًا بحثًا عن المقدمة والإعلان (حتى لو لم يُعثر على شيء). */
  skipChecked: boolean;
  /** ترتيب الحلقة داخل مجموعتها كما رتّبه المشرف (null = بلا ترتيب يدوي فيُرتَّب بالموسم والحلقة). */
  seriesOrder: number | null;
  /** عدد المشاهدات (يزيد مرة لكل زائر في كل جلسة). */
  views: number;
  /** عدد المعجبين بالفيديو (زر المفضلة). */
  likes: number;
  createdAt: number | null;
};

function norm(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** قائمة مسمّاة (تصنيفات/مجموعات) مع إمكانية إضافة عنصر جديد. */
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

/** وثائق الاقتصاص القديمة (تحمل clipStart/clipEnd): تُعامل كمخفية دائمًا حتى لا يظهر الفيديو الأصلي الكامل مكانها. */
function isLegacyClip(d: Record<string, unknown>): boolean {
  return typeof d.clipStart === "number" && typeof d.clipEnd === "number";
}

const secs = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.min(Math.floor(v), 36000) : null);

/** مدة الإعلان والمقدمة. الفيديوهات القديمة التي لها skipTo فقط تُعدّ مقدمة كلها. */
function toSkip(d: Record<string, unknown>): Pick<VideoDoc, "skipTo" | "adSec" | "introSec"> {
  const adSec = secs(d.adSec);
  let introSec = secs(d.introSec);
  const legacy = secs(d.skipTo);
  if (adSec === null && introSec === null && legacy !== null) introSec = legacy;
  const total = (adSec ?? 0) + (introSec ?? 0);
  return { adSec, introSec, skipTo: total >= 1 ? total : null };
}

/** ترتيب حلقات المجموعة: الترتيب اليدوي أولًا، ثم الموسم والحلقة، ثم الأقدم. */
export function compareInSeries(a: VideoDoc, b: VideoDoc): number {
  if (a.seriesOrder !== null && b.seriesOrder !== null && a.seriesOrder !== b.seriesOrder) return a.seriesOrder - b.seriesOrder;
  if ((a.seriesOrder !== null) !== (b.seriesOrder !== null)) return a.seriesOrder !== null ? -1 : 1;
  return (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0);
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
    hidden: d.hidden === true || isLegacyClip(d),
    duration: typeof d.duration === "number" && d.duration > 0 ? Math.round(d.duration) : null,
    clip: isLegacyClip(d),
    ...toSkip(d),
    skipChecked: d.skipChecked === true,
    seriesOrder: typeof d.seriesOrder === "number" && Number.isFinite(d.seriesOrder) ? d.seriesOrder : null,
    views: typeof d.views === "number" && d.views > 0 ? Math.floor(d.views) : 0,
    likes: typeof d.likes === "number" && d.likes > 0 ? Math.floor(d.likes) : 0,
    createdAt: ts(d.createdAt),
  };
}

/** يزيد عدّاد مشاهدات الفيديو مرة واحدة لكل جلسة متصفح. الفشل صامت (لا يمنع المشاهدة). */
export async function countView(id: string): Promise<boolean> {
  if (!isFirebaseConfigured) return false;
  try {
    const k = `viewed:${id}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, "1");
    await updateDoc(doc(getDb(), "videos", id), { views: increment(1) });
    return true;
  } catch {
    /* القواعد القديمة أو التخزين غير متاح: نتجاهل */
    return false;
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
 * كل الفيديوهات الظاهرة (غير المخفية) بلا حد 200، على دفعات من 500، مع تخزين مؤقت دقيقتين داخل الجلسة.
 * يُستعمل لحساب عدد حلقات كل مجموعة وصورتها؛ الحد القديم كان يُسقط المجموعات التي خرجت فيديوهاتها من آخر 200.
 */
const ALL_PAGE = 500;
const ALL_MAX_PAGES = 40; // حماية: 20 ألف فيديو كحد أقصى
let allCache: { at: number; videos: VideoDoc[] } | null = null;
let allInflight: Promise<VideoDoc[]> | null = null;

async function fetchEveryVideo(): Promise<VideoDoc[]> {
  if (allCache && Date.now() - allCache.at < 120_000) return allCache.videos;
  if (allInflight) return allInflight;
  allInflight = (async () => {
    const out: VideoDoc[] = [];
    let last: QueryDocumentSnapshot | undefined;
    for (let n = 0; n < ALL_MAX_PAGES; n++) {
      const col = collection(getDb(), "videos");
      const snap = await getDocs(last ? query(col, orderBy(documentId()), startAfter(last), limit(ALL_PAGE)) : query(col, orderBy(documentId()), limit(ALL_PAGE)));
      for (const d of snap.docs) out.push(toVideo(d.id, d.data()));
      if (snap.size < ALL_PAGE) break;
      last = snap.docs[snap.docs.length - 1];
    }
    const videos = out.filter((v) => !v.hidden);
    allCache = { at: Date.now(), videos };
    return videos;
  })().finally(() => {
    allInflight = null;
  });
  return allInflight;
}

/** الفيديوهات الظاهرة مجمّعة حسب معرّف المجموعة (كلها، لا آخر 200 فقط). */
export function useVideosBySeries() {
  const [bySeries, setBySeries] = useState<Map<string, VideoDoc[]>>(new Map());
  const [ready, setReady] = useState(!isFirebaseConfigured);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    fetchEveryVideo()
      .then((all) => {
        if (off) return;
        const m = new Map<string, VideoDoc[]>();
        for (const v of all) if (v.seriesId) m.set(v.seriesId, [...(m.get(v.seriesId) ?? []), v]);
        setBySeries(m);
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, []);
  return { bySeries, ready };
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
  // تلقائيًا: نفضّل الفيديو الذي له صورة مصغّرة، ثم الأكثر مشاهدة، ثم الأحدث.
  return (
    usable.find((v) => v.id === coverId) ??
    [...usable].sort((a, b) => Number(Boolean(b.thumbnail)) - Number(Boolean(a.thumbnail)) || b.views - a.views || (b.createdAt ?? 0) - (a.createdAt ?? 0))[0]
  );
}
