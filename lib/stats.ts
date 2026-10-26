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

/** مجاميع الموقع كلها بتجميع من الخادم (قراءة واحدة تقريبًا لكل ألف فيديو بدل قراءة كل الفيديوهات). */
export async function fetchTotals(): Promise<SiteTotals> {
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
export async function fetchDaily(days: number): Promise<DayPoint[]> {
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
  return out;
}
