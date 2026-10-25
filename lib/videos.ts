"use client";
import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, doc, documentId, getDocs, increment, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where, type QueryDocumentSnapshot } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";

export type Named = {
  id: string;
  name: string;
  /** فيديو الغلاف المختار للمجموعة (فارغ = تلقائي). */
  coverVideoId?: string;
  /** صورة مخصّصة للمجموعة (رابط /api/thumb لصورة مرفوعة من الجهاز، أو رابط صورة من درايف). تتغلّب على فيديو الغلاف. */
  coverImage?: string;
};

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

// ───────── تخزين مؤقت في متصفح الزائر (يوفّر قراءات Firestore: الزائر العائد لا يقرأ شيئًا خلال المدة) ─────────
const CACHE_TTL = 15 * 60_000;
const CACHE_PREFIX = "vc:";
function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const o = JSON.parse(raw) as { at?: number; v?: T };
    return o && typeof o.at === "number" && Date.now() - o.at < CACHE_TTL && o.v !== undefined ? o.v : null;
  } catch {
    return null;
  }
}
function cacheSet(key: string, v: unknown) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), v }));
  } catch {
    /* التخزين ممتلئ أو غير متاح: لا بأس */
  }
}
const slim = (list: VideoDoc[]): VideoDoc[] => list.map((v) => ({ ...v, description: v.description.slice(0, 300) }));

/** يمسح التخزين المؤقت للفيديوهات (يُستدعى بعد أي تعديل من لوحة التحكم كي يرى المشرف التغيير فورًا). */
export function clearVideoCache() {
  allCache = null;
  avatarCache = null;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
  } catch {
    /* لا بأس */
  }
}

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
        if (!off) setItems(snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? ""), coverVideoId: typeof d.data().coverVideoId === "string" ? (d.data().coverVideoId as string) : "", coverImage: cleanCoverImage(d.data().coverImage) })));
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

/** أحدث الفيديوهات الظاهرة للزوار (غير المخفية)، حتى `max` (الافتراضي 200). تُخزَّن 15 دقيقة في المتصفح. */
export function useAllVideos(max = 200) {
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    const key = `latest${max}`;
    const hit = cacheGet<VideoDoc[]>(key);
    if (hit) {
      setVideos(hit);
      setReady(true);
      return;
    }
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(max)))
      .then((snap) => {
        const list = snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => !v.hidden);
        cacheSet(key, slim(list));
        if (!off) setVideos(list);
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, [max]);
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
  if (allCache && Date.now() - allCache.at < CACHE_TTL) return allCache.videos;
  const stored = cacheGet<VideoDoc[]>("all");
  if (stored) {
    allCache = { at: Date.now(), videos: stored };
    return stored;
  }
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
    cacheSet("all", slim(videos));
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

/**
 * صورة كل مجموعة (تُعرض كصورة القناة بجانب اسم الفيديو): الفيديو الذي اختاره المشرف للمجموعة،
 * وإلا الأكثر مشاهدة من فيديوهاتها. تُخزَّن دقيقتين داخل الجلسة وتستعمل نفس جلب الفيديوهات المشترك.
 */
let avatarCache: { at: number; map: Map<string, string> } | null = null;
let avatarInflight: Promise<Map<string, string>> | null = null;

async function fetchSeriesAvatars(): Promise<Map<string, string>> {
  if (avatarCache && Date.now() - avatarCache.at < CACHE_TTL) return avatarCache.map;
  const stored = cacheGet<[string, string][]>("avatars");
  if (stored) {
    avatarCache = { at: Date.now(), map: new Map(stored) };
    return avatarCache.map;
  }
  if (avatarInflight) return avatarInflight;
  avatarInflight = (async () => {
    // الأصل: رابط الصورة الجاهز في مستند المجموعة (coverImage أو avatarUrl) فلا نقرأ أي فيديو.
    // يحدّثه المشرف تلقائيًا عند فتح «المجموعات» في لوحة التحكم. المجموعة التي لم يُحسب لها رابط بعد
    // (avatarUrl غير موجود) نحسبها بالطريقة القديمة من فيديوهاتها.
    const snap = await getDocs(collection(getDb(), "series"));
    const map = new Map<string, string>();
    const unresolved: { id: string; chosen: string }[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      const url = cleanCoverImage(data.coverImage) || cleanAvatarUrl(data.avatarUrl);
      if (url) map.set(d.id, url);
      else if (typeof data.avatarUrl !== "string") unresolved.push({ id: d.id, chosen: typeof data.coverVideoId === "string" ? (data.coverVideoId as string) : "" });
    }
    if (unresolved.length) {
      const all = await fetchEveryVideo();
      const by = new Map<string, VideoDoc[]>();
      for (const v of all) if (v.seriesId) by.set(v.seriesId, [...(by.get(v.seriesId) ?? []), v]);
      for (const u of unresolved) {
        const list = by.get(u.id) ?? [];
        const url = pickCover(list, u.chosen)?.thumbnail || pickCover(list, "")?.thumbnail || "";
        if (url) map.set(u.id, url);
      }
    }
    avatarCache = { at: Date.now(), map };
    cacheSet("avatars", [...map.entries()]);
    return map;
  })().finally(() => {
    avatarInflight = null;
  });
  return avatarInflight;
}

/** خريطة معرّف المجموعة ← رابط صورتها. تبدأ فارغة ثم تمتلئ عند وصول البيانات. */
export function useSeriesAvatars(): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(() => avatarCache?.map ?? new Map());
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    fetchSeriesAvatars()
      .then((m) => !off && setMap(m))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);
  return map;
}
