"use client";
import { useSyncExternalStore } from "react";

/**
 * مجموعة معرّفات محفوظة في المتصفح (المفضلة، الإعجابات…). كل مفتاح له مستمعوه،
 * فيتحدّث كل زر وكل صفحة فورًا عند أي تغيير (وبين تبويبات المتصفح عبر حدث storage).
 */
export function createLocalSet(key: string) {
  const listeners = new Set<() => void>();

  function read(): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  // نُرجع نصًا (لا مصفوفة) كي تقارنه React بالقيمة فلا تتكرر إعادة العرض.
  const snapshot = () => JSON.stringify(read());
  function subscribe(cb: () => void) {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  }
  function useIds(): string[] {
    const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
    return JSON.parse(raw) as string[];
  }
  function toggle(id: string) {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* التخزين غير متاح (وضع خاص) */
    }
    listeners.forEach((l) => l());
  }
  return { useIds, toggle };
}
