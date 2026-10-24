"use client";
import FavoriteButton from "@/components/FavoriteButton";
import Icon from "@/components/Icon";
import LikeButton from "@/components/LikeButton";
import ReportButton from "@/components/ReportButton";
import ShareButton from "@/components/ShareButton";
import { useSettings } from "@/lib/settings";
import type { VideoDoc } from "@/lib/videos";

/** صف الأزرار أسفل الفيديو: الترتيب والإظهار والأزرار الإضافية من لوحة التحكم (المظهر ← صفحة الفيديو). */
export default function WatchActions({ video }: { video: VideoDoc }) {
  const { settings } = useSettings();
  return (
    <div className="actions" role="group" aria-label="إجراءات الفيديو">
      {settings.watchButtons
        .filter((b) => b.show)
        .map((b) => {
          if (b.kind === "link") {
            return (
              <a key={b.id} className="ibtn ibtn--text" href={b.href} target="_blank" rel="noopener noreferrer">
                <Icon name={b.icon} size={20} />
                {b.label}
              </a>
            );
          }
          switch (b.id) {
            case "favorite":
              return <FavoriteButton key={b.id} id={video.id} />;
            case "like":
              return <LikeButton key={b.id} id={video.id} />;
            case "share":
              return <ShareButton key={b.id} title={video.title} />;
            case "report":
              return <ReportButton key={b.id} videoId={video.id} videoTitle={video.title} />;
            default:
              return null;
          }
        })}
    </div>
  );
}
