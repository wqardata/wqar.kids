"use client";
// إشعارات الموقع: مستند لكل إشعار في Firestore (notifications/{id}) يكتبه المشرف ويقرؤه الأعضاء المسجَّلون بحسب الفئة.
// المعرّف يبدأ بالوقت معكوسًا، فترتيب المعرّفات التصاعدي (الافتراضي في Firestore) = الأحدث أولًا بلا حاجة لفهرس مركّب.
import { useEffect, useState } from "react";
import { collection, getCountFromServer, limit, onSnapshot, query, where } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import { cleanUrl } from "./settingsCore";

export type Audience = "all" | "viewers" | "admins";
export const AUDIENCES: readonly { id: Audience; label: string; note: string }[] = [
  { id: "all", label: "كل الأعضاء المسجَّلين", note: "المشاهدون والمشرفون" },
  { id: "viewers", label: "المشاهدون فقط", note: "الأعضاء العاديون دون المشرفين" },
  { id: "admins", label: "المشرفون فقط", note: "من لهم صلاحية لوحة التحكم" },
];
export const audienceLabel = (a: Audience) => AUDIENCES.find((x) => x.id === a)?.label ?? a;

export type Notice = { id: string; title: string; body: string; link: string; audience: Audience; at: number };

/** كم إشعارًا يراه العضو في القائمة. */
export const NOTICE_SHOW = 30;

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
    audience: d.audience === "admins" ? "admins" : d.audience === "viewers" ? "viewers" : "all",
    at: t && typeof t.toMillis === "function" ? t.toMillis() : Date.now(),
  };
}

/** إشعارات العضو الحالي (مباشرة): للمشرف «الكل + المشرفين»، ولغيره «الكل + المشاهدين». */
export function useNotifications(uid: string | null, isAdmin: boolean) {
  const [items, setItems] = useState<Notice[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setItems([]);
    setFailed(false);
    if (!isFirebaseConfigured || !uid) return;
    const aud: Audience[] = isAdmin ? ["all", "admins"] : ["all", "viewers"];
    return onSnapshot(
      query(collection(getDb(), "notifications"), where("audience", "in", aud), limit(NOTICE_SHOW)),
      (snap) => setItems(snap.docs.map((d) => toNotice(d.id, d.data())).sort((a, b) => b.at - a.at)),
      () => setFailed(true), // القواعد لم تُحدَّث بعد
    );
  }, [uid, isAdmin]);
  return { items, failed };
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
