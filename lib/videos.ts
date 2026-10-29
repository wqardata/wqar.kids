"use client";
import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, doc, documentId, getDoc, getDocs, setDoc, increment, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where, type QueryDocumentSnapshot } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import { bumpDailyViews } from "./stats";
import { isPreviewFrame } from "./previewFrame";
import { USE_NEON } from "./backend";
import { adminCreateNamed } from "./neonAdminClient";
import { cleanAvatarUrl, cleanCoverImage } from "./coverUrl";
import { neonAllVideos, neonLatest, neonNamedList, neonPost, neonSetting, neonVideosByIds } from "./neonClient";

// تبقى مُصدَّرة من هنا كي لا تتغيّر استيرادات بقية الملفات.
export { cleanAvatarUrl, cleanCoverImage };

export type Named = {
  id: string;
  name: string;
  /** فيديو الغلاف المختار للمجموعة (فارغ = تلقائي). */
  coverVideoId?: string;
  /** صورة مخصّصة للمجموعة (رابط /api/thumb لصورة مرفوعة من الجهاز، أو رابط صورة من درايف). تتغلّب على فيديو الغلاف. */
  coverImage?: string;
};

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

// ───────── «رقم إصدار» الفيديوهات: مستند صغير settings/videosVersion يرفع المشرف قيمته عند كل إضافة/حذف/تعديل ─────────
// الزائر يقرأه (قراءة واحدة على الأكثر كل دقيقة)، فإن اختلف عمّا في متصفحه مسح تخزينه المؤقت وجلب القائمة الجديدة فورًا،
// وإلا بقي يستعمل التخزين المؤقت (15 دقيقة) دون قراءات إضافية. لا يحتاج تعديل قواعد Firestore (settings قراءتها عامة وكتابتها للمشرف).
const VER_KEY = CACHE_PREFIX + "ver";
const VER_AT_KEY = CACHE_PREFIX + "verAt";
const VER_CHECK_EVERY = 60_000;
let verInflight: Promise<void> | null = null;

function wipeVideoCache(keepVer?: string) {
  allCache = null;
  avatarCache = null;
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
    if (keepVer !== undefined) {
      localStorage.setItem(VER_KEY, keepVer);
      localStorage.setItem(VER_AT_KEY, String(Date.now()));
    }
  } catch {
    /* لا بأس */
  }
}

/** رقم إصدار الفيديوهات المنشور (من Firestore أو Neon بحسب مفتاح التشغيل). */
async function readRemoteVersion(): Promise<string> {
  if (USE_NEON) {
    const r = await neonSetting("videosVersion");
    return String((r.exists ? r.data.v : 0) ?? 0);
  }
  const snap = await getDoc(doc(getDb(), "settings", "videosVersion"));
  return String((snap.exists() ? snap.data().v : 0) ?? 0);
}

/** يتأكد أن التخزين المؤقت يطابق آخر إصدار منشور؛ يفشل بصمت (دون إنترنت يبقى التخزين المؤقت كما هو). */
export function ensureFreshVideos(): Promise<void> {
  if (!isFirebaseConfigured) return Promise.resolve();
  try {
    const at = Number(localStorage.getItem(VER_AT_KEY));
    if (localStorage.getItem(VER_KEY) !== null && Date.now() - at < VER_CHECK_EVERY) return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
  if (verInflight) return verInflight;
  verInflight = readRemoteVersion()
    .then((remote) => {
      let local: string | null = null;
      try { local = localStorage.getItem(VER_KEY); } catch { /* لا بأس */ }
      if (local !== remote) wipeVideoCache(remote);
      else { try { localStorage.setItem(VER_AT_KEY, String(Date.now())); } catch { /* لا بأس */ } }
    })
    .catch(() => {})
    .finally(() => { verInflight = null; });
  return verInflight;
}

/** يُستدعى من لوحة التحكم بعد أي إضافة/حذف/تعديل للفيديوهات: يرفع رقم الإصدار فتتحدّث أجهزة الزوار عند فتحها. */
export function bumpVideosVersion(): void {
  if (!isFirebaseConfigured) return;
  const now = Date.now();
  wipeVideoCache(String(now));
  if (USE_NEON) return; // على Neon يرفع الخادم الإصدار داخل كل عملية كتابة للمشرف (lib/neonAdmin.ts)
  void setDoc(doc(getDb(), "settings", "videosVersion"), { v: now }).catch(() => {});
}

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
  /** معرّف فيديو يوتيوب (فارغ = فيديو درايف). */
  youtubeId: string;
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

/** قراءة قائمة التصنيفات/المجموعات مرتبة بالاسم (Firestore أو Neon). */
async function loadNamed(coll: "categories" | "series"): Promise<Named[]> {
  if (USE_NEON) return (await neonNamedList(coll)).map(({ id, name, coverVideoId, coverImage }) => ({ id, name, coverVideoId, coverImage }));
  const snap = await getDocs(query(collection(getDb(), coll), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? ""), coverVideoId: typeof d.data().coverVideoId === "string" ? (d.data().coverVideoId as string) : "", coverImage: cleanCoverImage(d.data().coverImage) }));
}

/** قائمة مسمّاة (تصنيفات/مجموعات) مع إمكانية إضافة عنصر جديد. */
export function useNamedList(coll: "categories" | "series") {
  const [items, setItems] = useState<Named[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    loadNamed(coll)
      .then((list) => {
        if (!off) setItems(list);
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
      const newId = USE_NEON ? await adminCreateNamed(coll, name) : (await addDoc(collection(getDb(), coll), { name, createdAt: serverTimestamp() })).id;
      setItems((prev) => [...prev, { id: newId, name }].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      return newId;
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
    youtubeId: /^[A-Za-z0-9_-]{11}$/.test(s("youtubeId")) ? s("youtubeId") : "",
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
  if ((!USE_NEON && !isFirebaseConfigured) || isPreviewFrame()) return false; // معاينة اللوحة لا تُحتسب مشاهدة
  try {
    const k = `viewed:${id}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, "1");
    if (USE_NEON) {
      await neonPost("/api/data/view", { id }); // الخادم يزيد مشاهدات الفيديو وإحصاء اليوم معًا
      return true;
    }
    await updateDoc(doc(getDb(), "videos", id), { views: increment(1) });
    void bumpDailyViews(); // مخطط الإقبال اليومي في لوحة التحكم
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
    void ensureFreshVideos().then(() => {
      if (off) return undefined;
      const hit = cacheGet<VideoDoc[]>(key);
      if (hit) {
        setVideos(hit);
        setReady(true);
        return undefined;
      }
      return readLatest(max)
      .then((list) => {
        cacheSet(key, slim(list));
        if (!off) setVideos(list);
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    });
    return () => {
      off = true;
    };
  }, [max]);
  return { videos, ready };
}

/** أحدث `max` فيديو ظاهر (Firestore أو Neon). */
async function readLatest(max: number): Promise<VideoDoc[]> {
  if (USE_NEON) return (await neonLatest(max)).filter((v) => !v.hidden);
  const snap = await getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => !v.hidden);
}

const latestInflight = new Map<number, Promise<VideoDoc[]>>();

/**
 * نفس قراءة useAllVideos لكن كدالة (للمكوّنات التي تعالج القائمة بنفسها كالمقترحات والمقاطع القصيرة).
 * تشترك معها في التخزين المؤقت (15 دقيقة في المتصفح)، فلا تُحتسب قراءات جديدة من حصة Firestore
 * ما دامت القائمة نفسها قُرئت قبل قليل، وتدمج الطلبات المتزامنة في قراءة واحدة.
 */
export async function fetchLatestVideos(max: number): Promise<VideoDoc[]> {
  await ensureFreshVideos();
  const key = `latest${max}`;
  const hit = cacheGet<VideoDoc[]>(key);
  if (hit) return hit;
  const running = latestInflight.get(max);
  if (running) return running;
  const p = readLatest(max)
    .then((list) => {
      cacheSet(key, slim(list));
      return list;
    })
    .finally(() => latestInflight.delete(max));
  latestInflight.set(max, p);
  return p;
}

/**
 * كل الفيديوهات الظاهرة (غير المخفية) بلا حد 200، على دفعات من 500، مع تخزين مؤقت دقيقتين داخل الجلسة.
 * يُستعمل لحساب عدد حلقات كل مجموعة وصورتها؛ الحد القديم كان يُسقط المجموعات التي خرجت فيديوهاتها من آخر 200.
 */
const ALL_PAGE = 500;
const ALL_MAX_PAGES = 40; // حماية: 20 ألف فيديو كحد أقصى
let allCache: { at: number; videos: VideoDoc[] } | null = null;
let allInflight: Promise<VideoDoc[]> | null = null;

/** كل الفيديوهات الظاهرة (مخزّنة مؤقتًا كما في useEveryVideo). */
export async function fetchEveryVideo(): Promise<VideoDoc[]> {
  await ensureFreshVideos();
  if (allCache && Date.now() - allCache.at < CACHE_TTL) return allCache.videos;
  const stored = cacheGet<VideoDoc[]>("all");
  if (stored) {
    allCache = { at: Date.now(), videos: stored };
    return stored;
  }
  if (allInflight) return allInflight;
  allInflight = (async () => {
    if (USE_NEON) {
      const videos = (await neonAllVideos()).filter((v) => !v.hidden);
      allCache = { at: Date.now(), videos };
      cacheSet("all", slim(videos));
      return videos;
    }
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

/**
 * كل الفيديوهات الظاهرة مرتبة من الأحدث للأقدم (لا أحدث 100 فقط). تُقرأ مرة وتُخزَّن 15 دقيقة في المتصفح،
 * وتُستعمل في الرئيسية كي تختار «الأكثر مشاهدة» و«العشوائي» من كل المكتبة لا من آخر المضاف فقط.
 */
export function useEveryVideo() {
  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    fetchEveryVideo()
      .then((all) => !off && setVideos([...all].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))))
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, []);
  return { videos, ready };
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
    if (USE_NEON) {
      neonVideosByIds(list)
        .then((got) => !off && setVideos(got.filter((v) => !v.hidden)))
        .catch(() => {})
        .finally(() => !off && setReady(true));
      return () => {
        off = true;
      };
    }
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
  await ensureFreshVideos();
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
    // avatarUrl: نص = محسوب (ولو فارغًا)، null = لم يُحسب بعد. في Neon الفارغ يُعامَل كغير محسوب فيُحسب من الفيديوهات.
    type SeriesRaw = { id: string; coverImage: unknown; avatarUrl: unknown; coverVideoId: unknown };
    const raws: SeriesRaw[] = USE_NEON
      ? (await neonNamedList("series")).map((r) => ({ id: r.id, coverImage: r.coverImage, avatarUrl: r.avatarUrl || null, coverVideoId: r.coverVideoId }))
      : (await getDocs(collection(getDb(), "series"))).docs.map((d) => ({ ...(d.data() as Omit<SeriesRaw, "id">), id: d.id }));
    const map = new Map<string, string>();
    const unresolved: { id: string; chosen: string }[] = [];
    for (const data of raws) {
      const url = cleanCoverImage(data.coverImage) || cleanAvatarUrl(data.avatarUrl);
      if (url) map.set(data.id, url);
      else if (typeof data.avatarUrl !== "string") unresolved.push({ id: data.id, chosen: typeof data.coverVideoId === "string" ? data.coverVideoId : "" });
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
