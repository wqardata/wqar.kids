"use client";
import { useMemo } from "react";
import { SkeletonGrid } from "@/components/Skeleton";
import VideoGrid from "@/components/VideoGrid";
import { normalizeAr, useAllVideos } from "@/lib/videos";

export default function SearchResults({ q }: { q: string }) {
  const { videos, ready } = useAllVideos();
  const results = useMemo(() => {
    const terms = normalizeAr(q).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return videos.filter((v) => {
      const hay = normalizeAr(`${v.title} ${v.seriesName} ${v.categoryName} ${v.description}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [videos, q]);

  if (!ready) return <SkeletonGrid />;
  if (results.length === 0) return <p className="empty-note">لا توجد نتائج مطابقة. جرّب كلمة أقصر أو اسم المجموعة.</p>;
  return <VideoGrid items={results} />;
}
