"use client";

import { useSyncExternalStore } from "react";
import Icon from "@/components/Icon";

const KEY = "favorites";
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// نُرجع نصًا (لا مصفوفة) كي تقارنه React بالقيمة فلا تتكرر إعادة العرض.
function snapshot() {
  return JSON.stringify(read());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** قائمة معرّفات المفضلة (فارغة على الخادم). */
export function useFavorites(): string[] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  return JSON.parse(raw) as string[];
}

export function toggleFavorite(id: string) {
  const cur = read();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* التخزين غير متاح (وضع خاص) */
  }
  listeners.forEach((l) => l());
}

export default function FavoriteButton({ id }: { id: string }) {
  const on = useFavorites().includes(id);
  return (
    <button type="button" className={`fav${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleFavorite(id)}>
      <Icon name="heart" size={18} />
      {on ? "في المفضلة" : "أضف للمفضلة"}
    </button>
  );
}
