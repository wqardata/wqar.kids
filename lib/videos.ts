"use client";
import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";

export type Named = { id: string; name: string };

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
};

function norm(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** قائمة مسمّاة (تصنيفات/سلاسل) مع إمكانية إضافة عنصر جديد. */
export function useNamedList(coll: "categories" | "series") {
  const [items, setItems] = useState<Named[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDocs(query(collection(getDb(), coll), orderBy("name")))
      .then((snap) => {
        if (!off) setItems(snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? "") })));
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
  };
}
