"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { toVideo, type VideoDoc } from "@/lib/videos";

/** فيديوهات Firestore: الرئيسية (بدون القصيرة والمخفية) أو قسم «قصيرة». */
export default function AddedVideos({ mode = "home", emptyNote }: { mode?: "home" | "shorts"; emptyNote?: string }) {
  const [items, setItems] = useState<VideoDoc[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setReady(true);
      return;
    }
    let off = false;
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(100)))
      .then((snap) => {
        if (off) return;
        const all = snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => !v.hidden);
        setItems(all.filter((v) => (mode === "shorts" ? v.isShort : !v.isShort)).slice(0, 24));
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, [mode]);

  if (items.length === 0) return ready && emptyNote ? <p className="empty-note">{emptyNote}</p> : null;
  return (
    <section aria-labelledby={mode === "home" ? "added-title" : undefined}>
      {mode === "home" && <h2 id="added-title" className="page-title">أُضيف حديثًا</h2>}
      <ul className={mode === "shorts" ? "grid grid--shorts" : "grid"}>
        {items.map((v, i) => (
          <li key={v.id}>
            <Link href={`/v/${v.id}`} className="card">
              <div className="thumb" style={{ ["--h" as string]: (i * 47) % 360 }}>
                {v.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
              </div>
              <h3>{v.title}</h3>
              <p>{[v.categoryName, v.seriesName].filter(Boolean).join(" • ")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
