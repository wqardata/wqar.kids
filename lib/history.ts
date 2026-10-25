"use client";
import { useSyncExternalStore } from "react";

// سجل المشاهدة: يُحفظ في متصفح الزائر (مثل المفضلة والإعجابات) لأي شخص، مسجَّلًا كان أو لا.
const KEY = "watch-history";
const MAX = 200;

export type HistoryEntry = { id: string; at: number };

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
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* التخزين غير متاح (وضع خاص) */
  }
  listeners.forEach((l) => l());
}

/** يسجّل مشاهدة فيديو: يضعه في أول القائمة ويحدّث وقته إن كان موجودًا. */
export function recordView(id: string) {
  write([{ id, at: Date.now() }, ...read().filter((e) => e.id !== id)]);
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
