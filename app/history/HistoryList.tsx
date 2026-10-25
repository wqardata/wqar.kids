"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { clearHistory, removeFromHistory, useHistory } from "@/lib/history";
import { formatClock } from "@/lib/format";
import { useSeriesAvatars, useVideosByIds } from "@/lib/videos";
import VideoCaption from "@/components/VideoCaption";
import { SkeletonGrid, SkelCards } from "@/components/Skeleton";
import { usePaged } from "@/lib/usePaged";

function ago(at: number): string {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return new Date(at).toLocaleDateString("ar", { dateStyle: "medium" });
}

export default function HistoryList() {
  const entries = useHistory();
  const avatars = useSeriesAvatars();
  const { videos, ready } = useVideosByIds(entries.map((e) => e.id));
  const { gridRef, sentinelRef, visible, pending } = usePaged(videos.length);
  if (!ready) return <SkeletonGrid />;
  if (entries.length === 0) return <p className="empty-note">لا يوجد سجل بعد. ستظهر هنا الفيديوهات التي تشاهدها.</p>;
  const at = new Map(entries.map((e) => [e.id, e.at]));

  return (
    <>
      <div className="addrow history-bar">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            if (window.confirm("مسح سجل المشاهدة بالكامل من هذا الجهاز؟")) clearHistory();
          }}
        >
          مسح السجل
        </button>
      </div>
      <ul ref={gridRef} className="grid">
        {videos.slice(0, visible).map((v, i) => (
          <li key={v.id} className="history-item">
            <Link href={`/v/${v.id}`} className="card">
              <div className="thumb" style={{ ["--h" as string]: (i * 47) % 360 }}>
                {v.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
                {v.duration && <span className="dur">{formatClock(v.duration)}</span>}
              </div>
              <VideoCaption v={v} avatars={avatars} meta={false} />
            </Link>
            <div className="history-meta">
              <small>شوهد {ago(at.get(v.id) ?? 0)}</small>
              <button type="button" className="ibtn" aria-label={`إزالة «${v.title}» من السجل`} title="إزالة من السجل" onClick={() => removeFromHistory(v.id)}>
                <Icon name="close" size={18} />
              </button>
            </div>
          </li>
        ))}
        {pending > 0 && <SkelCards n={pending} />}
      </ul>
      <div ref={sentinelRef} className="grid-end" aria-hidden="true" />
      {videos.length === 0 && <p className="empty-note">الفيديوهات في سجلك لم تعد متاحة.</p>}
    </>
  );
}
