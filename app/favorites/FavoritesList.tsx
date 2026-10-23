"use client";

import VideoGrid from "@/components/VideoGrid";
import { useFavorites } from "@/components/FavoriteButton";
import { useAllVideos } from "@/lib/videos";

export default function FavoritesList() {
  const ids = useFavorites();
  const { videos, ready } = useAllVideos();
  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;
  const items = videos.filter((v) => ids.includes(v.id));
  if (items.length === 0) {
    return <p className="empty-note">لم تضف أي فيديو إلى المفضلة بعد. افتح فيديو واضغط «أضف للمفضلة».</p>;
  }
  return <VideoGrid items={items} />;
}
