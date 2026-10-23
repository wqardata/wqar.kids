"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { toVideo, type VideoDoc } from "@/lib/videos";

/** أحدث الفيديوهات المضافة من صفحة «إضافة فيديو». */
export default function AddedVideos() {
  const [items, setItems] = useState<VideoDoc[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(24)))
      .then((snap) => !off && setItems(snap.docs.map((d) => toVideo(d.id, d.data()))))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="added-title">
      <h2 id="added-title" className="page-title">أُضيف حديثًا</h2>
      <ul className="grid">
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
