"use client";

import VideoGrid from "@/components/VideoGrid";
import { useLikes } from "@/components/LikeButton";
import { useAllVideos } from "@/lib/videos";

export default function LikedList() {
  const ids = useLikes();
  const { videos, ready } = useAllVideos();
  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;
  const items = videos.filter((v) => ids.includes(v.id));
  if (items.length === 0) {
    return <p className="empty-note">لم تُعجَب بأي فيديو بعد. افتح فيديو واضغط على أيقونة الإعجاب.</p>;
  }
  return <VideoGrid items={items} />;
}
