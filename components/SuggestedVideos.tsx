"use client";
import Link from "next/link";
import { formatClock } from "@/lib/format";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { toVideo, type VideoDoc } from "@/lib/videos";

/** فيديوهات مقترحة: نفس السلسلة أولًا، ثم نفس التصنيف، ثم الأحدث. القائمة تتمرّر باستقلالية على الشاشات الكبيرة. */
export default function SuggestedVideos({ current }: { current: VideoDoc }) {
  const [items, setItems] = useState<VideoDoc[]>([]);
  const [ready, setReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(80)))
      .then((snap) => {
        if (off) return;
        const score = (v: VideoDoc) =>
          (current.seriesId && v.seriesId === current.seriesId ? 2 : 0) +
          (current.categoryId && v.categoryId === current.categoryId ? 1 : 0);
        const list = snap.docs
          .map((d) => toVideo(d.id, d.data()))
          .filter((v) => v.id !== current.id && !v.hidden && !v.isShort);
        // الفرز مستقر: عند تساوي النقاط يبقى الترتيب من الأحدث.
        setItems(list.map((v, i) => ({ v, i })).sort((a, b) => score(b.v) - score(a.v) || a.i - b.i).map((x) => x.v).slice(0, 30));
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, [current.id, current.seriesId, current.categoryId]);

  return (
    <aside className="suggest" aria-labelledby="sug-title">
      <h2 id="sug-title">فيديوهات مقترحة</h2>
      {!ready ? (
        <p className="empty-note" role="status">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <p className="empty-note">لا توجد فيديوهات أخرى بعد.</p>
      ) : (
        <div className="suggest-scroll" tabIndex={0} role="region" aria-label="قائمة الفيديوهات المقترحة">
          <ul className="suggest-list">
            {items.map((v) => (
              <li key={v.id}>
                <Link href={`/v/${v.id}`} className="sug">
                  <span className="sug-thumb">
                    {v.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                    {v.duration && <span className="dur">{formatClock(v.duration)}</span>}
                  </span>
                  <span className="sug-info">
                    <strong>{v.title}</strong>
                    <small>{[v.seriesName, v.categoryName].filter(Boolean).join(" • ")}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
