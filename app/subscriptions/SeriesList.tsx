"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { formatClock } from "@/lib/format";
import { SkeletonGrid, SkelCards } from "@/components/Skeleton";
import { usePaged } from "@/lib/usePaged";
import { pickCover, useAllVideos, useNamedList } from "@/lib/videos";

/** مجموعاتي: بطاقة لكل مجموعة بصورة أبرز فيديو فيها (المختار من لوحة التحكم، وإلا الأكثر مشاهدة). */
export default function SeriesList() {
  const series = useNamedList("series");
  const { videos, ready } = useAllVideos();
  const { canAdd } = useAuth();
  const { gridRef, sentinelRef, visible, pending } = usePaged(series.items.length);

  if (series.loading || !ready) return <SkeletonGrid />;
  return (
    <>
      {canAdd && (
        <div className="series-tools">
          <Link href="/admin?go=series" className="btn btn--sm">تحرير المجموعات</Link>
        </div>
      )}
      {series.items.length === 0 ? (
        <p className="empty-note">لا توجد مجموعات بعد.</p>
      ) : (
        <>
        <ul ref={gridRef} className="grid">
          {series.items.slice(0, visible).map((s, i) => {
            const mine = videos.filter((v) => v.seriesId === s.id);
            const cover = pickCover(mine, s.coverVideoId);
            return (
              <li key={s.id}>
                <Link href={`/series/${s.id}`} className="card">
                  <div className="thumb" style={{ ["--h" as string]: (i * 47) % 360 }}>
                    {cover?.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                    {!cover?.thumbnail && <span className="series-letter" aria-hidden="true">{s.name[0]}</span>}
                    {cover?.duration && <span className="dur">{formatClock(cover.duration)}</span>}
                  </div>
                  <h3>{s.name}</h3>
                  <p>{mine.length} حلقة</p>
                </Link>
              </li>
            );
          })}
          {pending > 0 && <SkelCards n={pending} />}
        </ul>
        <div ref={sentinelRef} className="grid-end" aria-hidden="true" />
        </>
      )}
    </>
  );
}
