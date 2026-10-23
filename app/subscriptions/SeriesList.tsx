"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useAllVideos, useNamedList } from "@/lib/videos";

export default function SeriesList() {
  const series = useNamedList("series");
  const { videos, ready } = useAllVideos();

  if (series.loading || !ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;
  if (series.items.length === 0) return <p className="empty-note">لا توجد مجموعات بعد.</p>;
  return (
    <ul className="groups">
      {series.items.map((s, i) => (
        <li key={s.id}>
          <Link href={`/series/${s.id}`} className="group">
            <span className="avatar" style={{ "--h": (i * 47) % 360 } as CSSProperties} aria-hidden="true">{s.name[0]}</span>
            <span>
              <strong>{s.name}</strong>
              <small>{videos.filter((v) => v.seriesId === s.id).length} حلقة</small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
