import SeriesAvatar from "@/components/SeriesAvatar";
import { viewsAndAge } from "@/lib/format";
import type { VideoDoc } from "@/lib/videos";

/** سطر ما تحت الصورة المصغّرة: صورة المجموعة، ثم العنوان، ثم اسم المجموعة (بلا التصنيف) والمشاهدات. */
export default function VideoCaption({ v, avatars, size = 36, meta = true }: { v: VideoDoc; avatars: ReadonlyMap<string, string>; size?: number; meta?: boolean }) {
  return (
    <div className="card-row">
      {v.seriesName && <SeriesAvatar name={v.seriesName} url={avatars.get(v.seriesId)} size={size} />}
      <div className="card-text">
        <h3>{v.title}</h3>
        {v.seriesName && <p>{v.seriesName}</p>}
        {meta && <p className="meta">{viewsAndAge(v.views, v.createdAt)}</p>}
      </div>
    </div>
  );
}
