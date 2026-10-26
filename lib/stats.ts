"use client";
import { collection, doc, getAggregateFromServer, getDocs, orderBy, query, setDoc, sum, count, updateDoc, increment, where, limit } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";

/** مفتاح اليوم بتوقيت UTC بصيغة YYYY-MM-DD (موحَّد بين الزوار والمشرف). */
export function dayKey(t: number = Date.now()): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * يزيد عدّاد مشاهدات اليوم في stats/d-YYYY-MM-DD (يغذّي مخطط الإقبال في لوحة التحكم).
 * الفشل صامت: لا يمنع المشاهدة ولا يظهر للزائر (مثلًا إن لم تُحدَّث القواعد بعد).
 */
export async function bumpDailyViews(): Promise<void> {
  if (!isFirebaseConfigured) return;
  const day = dayKey();
  const ref = doc(getDb(), "stats", `d-${day}`);
  try {
    await updateDoc(ref, { views: increment(1) });
  } catch {
    try {
      await setDoc(ref, { day, views: 1 });
    } catch {
      /* لا بأس */
    }
  }
}

export type SiteTotals = {
  views: number;
  likes: number;
  videos: number;
  hidden: number;
  shorts: number;
  /** بلاغات لم تُعالَج بعد. */
  reportsOpen: number;
};

// نتائج الإحصائيات تُخزَّن في المتصفح عدّة دقائق: فتح اللوحة مرارًا لا يكرّر القراءات. زر «تحديث» يتجاوز التخزين دائمًا.
const STATS_TTL = 10 * 60_000;
function cacheRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`stats-cache:${key}`);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; data: T };
    return Date.now() - v.at < STATS_TTL ? v.data : null;
  } catch {
    return null;
  }
}
function cacheWrite(key: string, data: unknown) {
  try {
    localStorage.setItem(`stats-cache:${key}`, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* التخزين غير متاح */
  }
}

/**
 * مجاميع الموقع بتجميع من الخادم (قراءة واحدة تقريبًا لكل ألف فيديو).
 * `manual` = ضغط المشرف «تحديث»: يتجاوز التخزين المؤقت، وهو وحده من يُسمح له بالبديل الأغلى (قراءة كل الفيديوهات) إن فشل التجميع.
 */
export async function fetchTotals(manual = false): Promise<SiteTotals> {
  if (!manual) {
    const hit = cacheRead<SiteTotals>("totals");
    if (hit) return hit;
  }
  let out: SiteTotals;
  try {
    out = await fetchTotalsAggregate();
  } catch (e) {
    if (!manual) throw e; // لا نلجأ للقراءة الكاملة تلقائيًا؛ يقرّر المشرف بزر «تحديث»
    console.warn("[stats] التجميع من الخادم فشل، نحسب من قراءة الفيديوهات", e);
    out = await fetchTotalsByReading();
  }
  cacheWrite("totals", out);
  return out;
}

/** بديل أبطأ (قراءة لكل فيديو) يعمل حتى لو فشل التجميع من الخادم لأي سبب. */
async function fetchTotalsByReading(): Promise<SiteTotals> {
  const snap = await getDocs(collection(getDb(), "videos"));
  let views = 0;
  let likes = 0;
  let hidden = 0;
  let shorts = 0;
  for (const d of snap.docs) {
    const x = d.data();
    views += Number(x.views) || 0;
    likes += Number(x.likes) || 0;
    if (x.hidden === true) hidden++;
    if (x.isShort === true) shorts++;
  }
  let reportsOpen = 0;
  try {
    reportsOpen = (await getAggregateFromServer(query(collection(getDb(), "reports"), where("status", "==", "open")), { n: count() })).data().n;
  } catch {
    try {
      reportsOpen = (await getDocs(query(collection(getDb(), "reports"), where("status", "==", "open")))).size;
    } catch {
      /* لا بأس */
    }
  }
  return { views: Math.max(0, Math.round(views)), likes: Math.max(0, Math.round(likes)), videos: snap.size, hidden, shorts, reportsOpen };
}

async function fetchTotalsAggregate(): Promise<SiteTotals> {
  const col = collection(getDb(), "videos");
  const [all, hidden, shorts, reports] = await Promise.all([
    getAggregateFromServer(col, { views: sum("views"), likes: sum("likes"), n: count() }),
    getAggregateFromServer(query(col, where("hidden", "==", true)), { n: count() }),
    getAggregateFromServer(query(col, where("isShort", "==", true)), { n: count() }),
    getAggregateFromServer(query(collection(getDb(), "reports"), where("status", "==", "open")), { n: count() }).catch(() => null),
  ]);
  const a = all.data();
  return {
    views: Math.max(0, Math.round(Number(a.views) || 0)),
    likes: Math.max(0, Math.round(Number(a.likes) || 0)),
    videos: a.n,
    hidden: hidden.data().n,
    shorts: shorts.data().n,
    reportsOpen: reports ? reports.data().n : 0,
  };
}

export type DayPoint = { day: string; views: number };

/** مشاهدات آخر `days` يومًا (تشمل اليوم)، مع تعبئة الأيام الخالية بصفر، من الأقدم إلى الأحدث. */
export async function fetchDaily(days: number, manual = false): Promise<DayPoint[]> {
  if (!manual) {
    const hit = cacheRead<DayPoint[]>(`daily-${days}-${dayKey()}`);
    if (hit) return hit;
  }
  const start = dayKey(Date.now() - (days - 1) * 86_400_000);
  const snap = await getDocs(query(collection(getDb(), "stats"), where("day", ">=", start), orderBy("day"), limit(days + 5)));
  const by = new Map<string, number>();
  for (const d of snap.docs) {
    const x = d.data();
    if (typeof x.day === "string" && typeof x.views === "number") by.set(x.day, x.views);
  }
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(Date.now() - i * 86_400_000);
    out.push({ day: k, views: by.get(k) ?? 0 });
  }
  cacheWrite(`daily-${days}-${dayKey()}`, out);
  return out;
}
