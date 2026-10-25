"use client";
// إشعارات الموقع: مستند لكل إشعار في Firestore (notifications/{id}) يكتبه المشرف ويقرؤه الأعضاء المسجَّلون بحسب الفئة.
// المعرّف يبدأ بالوقت معكوسًا، فترتيب المعرّفات التصاعدي (الافتراضي في Firestore) = الأحدث أولًا بلا حاجة لفهرس مركّب.
import { useEffect, useState } from "react";
import { collection, getCountFromServer, limit, onSnapshot, query, where } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import { cleanUrl } from "./settingsCore";

export type Audience = "all" | "viewers" | "admins" | "guests";
export const AUDIENCES: readonly { id: Audience; label: string; note: string }[] = [
  { id: "all", label: "كل الأعضاء المسجَّلين", note: "المشاهدون والمشرفون" },
  { id: "viewers", label: "المشاهدون فقط", note: "الأعضاء العاديون دون المشرفين" },
  { id: "admins", label: "المشرفون فقط", note: "من لهم صلاحية لوحة التحكم" },
  { id: "guests", label: "غير المسجَّلين", note: "الزوار الذين لم يسجّلوا دخولًا" },
];
export const audienceLabel = (a: Audience) => AUDIENCES.find((x) => x.id === a)?.label ?? a;

export type Notice = { id: string; title: string; body: string; link: string; audience: Audience; at: number };

/** كم إشعارًا يراه العضو في القائمة. */
export const NOTICE_SHOW = 5;

export function newNoticeId(): string {
  const rev = String(9_999_999_999_999 - Date.now()).padStart(13, "0");
  return `${rev}-${Math.random().toString(36).slice(2, 7)}`;
}

/** رابط داخلي (يبدأ بـ /) أو http(s) فقط؛ غير ذلك يُحذف. */
export function cleanLink(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("/") && !t.startsWith("//") && t.length <= 300 && !/\s/.test(t)) return t;
  return cleanUrl(t);
}

export function toNotice(id: string, d: Record<string, unknown>): Notice {
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const t = d.createdAt as { toMillis?: () => number } | null | undefined;
  return {
    id,
    title: s("title").slice(0, 80),
    body: s("body").slice(0, 500),
    link: cleanLink(s("link")),
    audience: d.audience === "admins" ? "admins" : d.audience === "viewers" ? "viewers" : d.audience === "guests" ? "guests" : "all",
    at: t && typeof t.toMillis === "function" ? t.toMillis() : Date.now(),
  };
}

/** الفئات التي يقرؤها كل نوع من الزوّار: الزائر «guests»، العضو «all + viewers»، والمشرف «all + admins». */
export function audiencesFor(uid: string | null, isAdmin: boolean): Audience[] {
  if (!uid) return ["guests"];
  return isAdmin ? ["all", "admins"] : ["all", "viewers"];
}

/**
 * إشعارات الزائر الحالي (مباشرة). نشترك في كل فئة باستعلام مساواة مستقل (audience == X) لا بـ «in»:
 * هكذا تُثبت قواعد Firestore أن كل استعلام مسموح، ولا يُسقط رفضُ فئة واحدة بقية الفئات.
 * `ready` = انتهى تحميل حالة الدخول (قبلها لا نشترك كي لا نبدأ كزائر ثم نتحوّل لعضو).
 */
export function useNotifications(uid: string | null, isAdmin: boolean, ready = true) {
  const [byAud, setByAud] = useState<Partial<Record<Audience, Notice[]>>>({});
  const [denied, setDenied] = useState<Audience[]>([]);
  useEffect(() => {
    setByAud({});
    setDenied([]);
    if (!isFirebaseConfigured || !ready) return;
    let off = false; // بعد الإلغاء (تسجيل خروج/دخول) نتجاهل أخطاء الصلاحيات المتأخرة
    const auds = audiencesFor(uid, isAdmin);
    const unsubs = auds.map((a) =>
      onSnapshot(
        query(collection(getDb(), "notifications"), where("audience", "==", a), limit(NOTICE_SHOW)),
        (snap) => !off && setByAud((p) => ({ ...p, [a]: snap.docs.map((d) => toNotice(d.id, d.data())) })),
        () => !off && setDenied((p) => (p.includes(a) ? p : [...p, a])), // القواعد لم تُحدَّث بعد أو لا صلاحية
      ),
    );
    return () => {
      off = true;
      unsubs.forEach((u) => u());
    };
  }, [uid, isAdmin, ready]);

  const items = Object.values(byAud)
    .flat()
    .filter((n): n is Notice => Boolean(n))
    .sort((a, b) => b.at - a.at)
    .slice(0, NOTICE_SHOW);
  const total = audiencesFor(uid, isAdmin).length;
  return { items, failed: denied.length >= total && total > 0, denied };
}

/** عدد البلاغات المفتوحة (للمشرف فقط). يُحدَّث كل دقيقتين ويمكن استدعاء refresh يدويًا. */
export function useOpenReports(enabled: boolean) {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled || !isFirebaseConfigured) {
      setCount(0);
      return;
    }
    let off = false;
    getCountFromServer(query(collection(getDb(), "reports"), where("status", "==", "open")))
      .then((r) => !off && setCount(r.data().count))
      .catch(() => {});
    const t = setTimeout(() => setTick((n) => n + 1), 120_000);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [enabled, tick]);
  return { count, refresh: () => setTick((n) => n + 1) };
}

// إشعارات أزالها المستخدم بنفسه بعد قراءتها (محفوظة في متصفحه لكل حساب).
const goneKey = (uid: string) => `notif-gone:${uid}`;
export function readGone(uid: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(goneKey(uid)) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function writeGone(uid: string, ids: string[]) {
  try {
    localStorage.setItem(goneKey(uid), JSON.stringify(ids.slice(-200)));
  } catch {
    /* التخزين غير متاح */
  }
}

// آخر وقت فتح فيه العضو قائمة الإشعارات (محفوظ في المتصفح لكل حساب).
const seenKey = (uid: string) => `notif-seen:${uid}`;
export function readSeen(uid: string): number {
  try {
    const v = Number(localStorage.getItem(seenKey(uid)));
    if (Number.isFinite(v) && v > 0) return v;
    // أول زيارة: ما سبق لا يُعدّ «جديدًا».
    const now = Date.now();
    localStorage.setItem(seenKey(uid), String(now));
    return now;
  } catch {
    return Date.now();
  }
}
export function writeSeen(uid: string, at: number) {
  try {
    localStorage.setItem(seenKey(uid), String(at));
  } catch {
    /* التخزين غير متاح */
  }
}

/** «قبل 5 دقائق» بالعربية. */
export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "الآن";
  const m = Math.floor(s / 60);
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 30) return `قبل ${d} يوم`;
  return new Date(at).toLocaleDateString("ar", { dateStyle: "medium" });
}
