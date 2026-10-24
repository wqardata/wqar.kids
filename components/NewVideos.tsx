"use client";
import VideoGrid from "@/components/VideoGrid";
import { useAllVideos } from "@/lib/videos";

/** صفحة «الجديد»: أحدث ما أُضيف مرتبًا من الأحدث للأقدم (فيديوهات ثم مقاطع قصيرة). */
export default function NewVideos() {
  const { videos, ready } = useAllVideos();
  const regular = videos.filter((v) => !v.isShort).slice(0, 60);
  const shorts = videos.filter((v) => v.isShort).slice(0, 20);

  if (videos.length === 0) return ready ? <p className="empty-note">لا توجد فيديوهات بعد.</p> : null;
  return (
    <>
      {regular.length > 0 && <VideoGrid items={regular} />}
      {shorts.length > 0 && (
        <section aria-labelledby="new-shorts">
          <h2 id="new-shorts" className="page-title">مقاطع قصيرة جديدة</h2>
          <VideoGrid items={shorts} shorts />
        </section>
      )}
    </>
  );
}
