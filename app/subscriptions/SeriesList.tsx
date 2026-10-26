"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
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
                {/* بطاقة مجموعة بشكل «قائمة التشغيل»: طبقات مكدّسة خلف الصورة ولوحة عدّاد الحلقات على جانبها */}
                <Link href={`/series/${s.id}`} className="card card--pl">
                  <div className="pl">
                    <div className="thumb" style={{ ["--h" as string]: (i * 47) % 360 }}>
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                      )}
                      {!img && <span className="series-letter" aria-hidden="true">{s.name[0]}</span>}
                      <span className="pl-count" aria-hidden="true">
                        <strong>{mine.length.toLocaleString("ar-EG")}</strong>
                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h11M3 11h11M3 16h6" /><path d="M16 13v7l6-3.5z" fill="currentColor" /></svg>
                      </span>
                      <span className="pl-hover" aria-hidden="true"><Icon name="play" size={20} /> عرض المجموعة</span>
                    </div>
                  </div>
                  <h3>{s.name}</h3>
                  <p>مجموعة • {mine.length} حلقة{showTotal && total > 0 ? ` • ${formatClock(total)}` : ""}</p>
                  <p className="pl-link">عرض المجموعة كاملة</p>
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
