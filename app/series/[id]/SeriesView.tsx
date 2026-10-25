"use client";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import VideoGrid from "@/components/VideoGrid";
import { SkeletonGrid } from "@/components/Skeleton";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { shuffled } from "@/lib/format";
import { toVideo, type VideoDoc } from "@/lib/videos";

export default function SeriesView({ id }: { id: string }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<VideoDoc[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "missing">(isFirebaseConfigured ? "loading" : "missing");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    Promise.all([getDoc(doc(getDb(), "series", id)), getDocs(query(collection(getDb(), "videos"), where("seriesId", "==", id)))])
      .then(([s, snap]) => {
        if (off) return;
        if (!s.exists()) return setState("missing");
        const n = String(s.data().name ?? "");
        document.title = n;
        setName(n);
        // الترتيب عشوائي في كل زيارة. لإرجاع ترتيب الحلقات: استبدل shuffled(...) بـ [...].sort(compareInSeries).
        setItems(
          shuffled(
          snap.docs
            .map((d) => toVideo(d.id, d.data()))
            .filter((v) => !v.hidden),
          ),
        );
        setState("ok");
      })
      .catch(() => !off && setState("missing"));
    return () => {
      off = true;
    };
  }, [id]);

  if (state === "loading") return <SkeletonGrid />;
  if (state === "missing") return <p className="empty-note">لم يُعثر على هذه المجموعة.</p>;
  return (
    <>
      <h1 className="page-title">{name}</h1>
      {items.length ? <VideoGrid items={items} /> : <p className="empty-note">لا توجد حلقات في هذه المجموعة بعد.</p>}
    </>
  );
}
