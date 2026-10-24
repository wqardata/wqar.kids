"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { SkeletonGrid } from "@/components/Skeleton";
import VideoGrid from "@/components/VideoGrid";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { toVideo, type VideoDoc } from "@/lib/videos";

/** فيديوهات Firestore: الرئيسية (بدون القصيرة والمخفية) أو قسم «قصيرة». */
export default function AddedVideos({ mode = "home", emptyNote, showHeading = mode === "home" }: { mode?: "home" | "shorts"; emptyNote?: string; showHeading?: boolean }) {
  const [items, setItems] = useState<VideoDoc[]>([]);
  const [ready, setReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(100)))
      .then((snap) => {
        if (off) return;
        const all = snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => !v.hidden);
        setItems(all.filter((v) => (mode === "shorts" ? v.isShort : !v.isShort)).slice(0, 48));
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, [mode]);

  if (!ready) return <SkeletonGrid shorts={mode === "shorts"} n={mode === "shorts" ? 10 : 8} />;
  if (items.length === 0) return ready && emptyNote ? <p className="empty-note">{emptyNote}</p> : null;
  return (
    <section aria-labelledby={showHeading ? "added-title" : undefined}>
      {showHeading && <h2 id="added-title" className="page-title">أُضيف حديثًا</h2>}
      <VideoGrid items={items} shorts={mode === "shorts"} />
    </section>
  );
}
