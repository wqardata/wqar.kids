"use client";

import { SkeletonGrid } from "@/components/Skeleton";
import VideoGrid from "@/components/VideoGrid";
import { useFavorites } from "@/components/FavoriteButton";
import { useAllVideos } from "@/lib/videos";

export default function FavoritesList() {
  const ids = useFavorites();
  const { videos, ready } = useAllVideos();
  if (!ready) return <SkeletonGrid />;
  const items = videos.filter((v) => ids.includes(v.id));
  if (items.length === 0) {
    return <p className="empty-note">لم تضف أي فيديو إلى المفضلة بعد. افتح فيديو واضغط على أيقونة القلب.</p>;
  }
  return <VideoGrid items={items} />;
}
