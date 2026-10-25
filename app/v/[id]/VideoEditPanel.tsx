"use client";
import VideoEditForm from "@/app/admin/VideoEditForm";
import { useNamedList, type VideoDoc } from "@/lib/videos";

/** لوحة تعديل الفيديو داخل صفحة عرضه (للمشرف فقط). تُحمَّل عند الطلب كي لا تثقل صفحة الزوار. */
export default function VideoEditPanel({ video, onSaved, onCancel }: { video: VideoDoc; onSaved: (v: VideoDoc) => void; onCancel: () => void }) {
  const categories = useNamedList("categories");
  const series = useNamedList("series");
  return (
    <section className="panel watch-edit" aria-label="تعديل الفيديو">
      <h2>تعديل الفيديو</h2>
      <VideoEditForm video={video} categories={categories} series={series} onSaved={onSaved} onCancel={onCancel} />
    </section>
  );
}
