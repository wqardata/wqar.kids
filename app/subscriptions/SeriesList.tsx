"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useMemo } from "react";
import { formatClock } from "@/lib/format";
import { SkeletonGrid, SkelCards } from "@/components/Skeleton";
import { usePaged } from "@/lib/usePaged";
import { useSettings } from "@/lib/settings";
import { pickCover, useNamedList, useVideosBySeries } from "@/lib/videos";

/**
 * مجموعاتي: بطاقة لكل مجموعة بصورتها (المخصّصة من لوحة التحكم، أو صورة الفيديو المختار، وإلا الأكثر مشاهدة)،
 * وعليها إجمالي مدة حلقاتها (مجموع المدد المحسوبة للفيديوهات).
 */
export default function SeriesList() {
  const series = useNamedList("series");
  const { bySeries, ready } = useVideosBySeries();
  const { canAdd } = useAuth();
  const { settings } = useSettings();
  const showTotal = settings.display.seriesShowDuration;
  // الأحدث إضافةً في الأعلى: المجموعة التي أُضيف إليها فيديو أخيرًا (أو أُنشئت أخيرًا) أولًا، والفارغة في الآخر.
  const order = useMemo(() => {
    const last = (id: string) => Math.max(0, ...(bySeries.get(id) ?? []).map((v) => v.createdAt ?? 0));
    return [...series.items].sort((a, b) => last(b.id) - last(a.id));
  }, [series.items, bySeries]);
  const { gridRef, sentinelRef, visible, pending } = usePaged(order.length);

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
          {order.slice(0, visible).map((s, i) => {
            const mine = bySeries.get(s.id) ?? [];
            const cover = pickCover(mine, s.coverVideoId);
            const img = s.coverImage || cover?.thumbnail || "";
            const total = mine.reduce((sum, v) => sum + (v.duration && v.duration > 0 ? v.duration : 0), 0);
            return (
              <li key={s.id}>
                <Link href={`/series/${s.id}`} className="card">
                  <div className="thumb" style={{ ["--h" as string]: (i * 47) % 360 }}>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                    {!img && <span className="series-letter" aria-hidden="true">{s.name[0]}</span>}
                    {showTotal && total > 0 && <span className="dur" title="إجمالي مدة الحلقات">{formatClock(total)}</span>}
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
