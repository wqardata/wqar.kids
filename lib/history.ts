"use client";
import { isPreviewFrame } from "./previewFrame";
import { useSyncExternalStore } from "react";

// سجل المشاهدة: يُحفظ في متصفح الزائر (مثل المفضلة والإعجابات) لأي شخص، مسجَّلًا كان أو لا.
const KEY = "watch-history";
const MAX = 200;

/** watched: ثواني المشاهدة التقديرية (وقت بقاء صفحة الفيديو ظاهرة)؛ done: بلغت 90% من مدة الفيديو. */
export type HistoryEntry = { id: string; at: number; watched?: number; done?: boolean };

const listeners = new Set<() => void>();

function read(): HistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is HistoryEntry => x && typeof x.id === "string" && typeof x.at === "number");
  } catch {
    return [];
  }
}

function write(list: HistoryEntry[]) {
  if (isPreviewFrame()) return; // معاينة لوحة التحكم لا تلوّث سجل المشرف
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* التخزين غير متاح (وضع خاص) */
  }
  listeners.forEach((l) => l());
}

/**
 * يسجّل مشاهدة فيديو: يضعه في أول القائمة ويحدّث وقته إن كان موجودًا.
 * تُحفظ ثواني المشاهدة السابقة إن لم يكن قد اكتمل؛ وإن اكتمل فالفتح الجديد يبدأ من الصفر.
 */
export function recordView(id: string) {
  const list = read();
  const prev = list.find((e) => e.id === id);
  const keep = prev && !prev.done && prev.watched ? { watched: prev.watched } : {};
  write([{ id, at: Date.now(), ...keep }, ...list.filter((e) => e.id !== id)]);
}

/** يضيف ثواني مشاهدة تقديرية لفيديو في السجل، ويعلّمه مكتملًا عند بلوغ 90% من مدته (إن عُرفت). */
export function addWatched(id: string, sec: number, duration: number | null) {
  if (!(sec > 0)) return;
  const list = read();
  const i = list.findIndex((e) => e.id === id);
  if (i < 0 || list[i].done) return;
  const cap = duration && duration > 0 ? duration : 4 * 3600;
  const watched = Math.min(cap, (list[i].watched ?? 0) + sec);
  list[i] = { ...list[i], watched, done: Boolean(duration && watched >= duration * 0.9) };
  write(list);
}

export function removeFromHistory(id: string) {
  write(read().filter((e) => e.id !== id));
}

export function clearHistory() {
  write([]);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** السجل من الأحدث للأقدم (فارغ على الخادم). */
export function useHistory(): HistoryEntry[] {
  // نص (لا مصفوفة) كي لا تتكرر إعادة العرض.
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(read()), () => "[]");
  return JSON.parse(raw) as HistoryEntry[];
}
