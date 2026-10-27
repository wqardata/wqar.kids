import SeriesAvatar from "@/components/SeriesAvatar";
import VideoStats from "@/components/VideoStats";
import type { VideoDoc } from "@/lib/videos";

/** سطر ما تحت الصورة المصغّرة: صورة المجموعة، ثم العنوان، ثم اسم المجموعة وبجانبه 👁 المشاهدات 🕐 المدة (بلا التصنيف). */
export default function VideoCaption({ v, avatars, size = 36, meta = true }: { v: VideoDoc; avatars: ReadonlyMap<string, string>; size?: number; meta?: boolean }) {
  return (
    <div className="card-row">
      {v.seriesName && <SeriesAvatar name={v.seriesName} url={avatars.get(v.seriesId)} size={size} />}
      <div className="card-text">
        <h3>{v.title}</h3>
        {(v.seriesName || meta) && (
          <p className="card-sub">
            {v.seriesName && <span className="card-series">{v.seriesName}</span>}
            {meta && <VideoStats views={v.views} createdAt={v.createdAt} />}
          </p>
        )}
      </div>
    </div>
  );
}
