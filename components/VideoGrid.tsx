"use client";
import Link from "next/link";
import { SkelCards } from "@/components/Skeleton";
import { formatClock, viewsAndAge } from "@/lib/format";
import { usePaged } from "@/lib/usePaged";
import type { VideoDoc } from "@/lib/videos";

/** شبكة بطاقات لفيديوهات Firestore: خمسة صفوف أولًا، ثم صفّان إضافيان كلما نزلت لآخر صف. */
export default function VideoGrid({ items, shorts = false, className = "", all = false }: { items: readonly VideoDoc[]; shorts?: boolean; className?: string; /** عرض كل العناصر بلا ترقيم. */ all?: boolean }) {
  const paged = usePaged(items.length);
  const { gridRef, sentinelRef, pending } = paged;
  const visible = all ? items.length : paged.visible;
  return (
    <>
      <ul ref={gridRef} className={`${shorts ? "grid grid--shorts" : "grid"}${className ? ` ${className}` : ""}`}>
        {items.slice(0, visible).map((v, i) => (
          <li key={v.id}>
            <Link href={`/v/${v.id}`} className="card">
              <div className="thumb" style={{ ["--h" as string]: (i * 47) % 360 }}>
                {v.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
                {v.duration && <span className="dur">{formatClock(v.duration)}</span>}
              </div>
              <h3>{v.title}</h3>
              <p>{[v.categoryName, v.seriesName].filter(Boolean).join(" • ")}</p>
              <p className="meta">{viewsAndAge(v.views, v.createdAt)}</p>
            </Link>
          </li>
        ))}
        {pending > 0 && <SkelCards n={pending} shorts={shorts} />}
      </ul>
      {!all && <div ref={sentinelRef} className="grid-end" aria-hidden="true" />}
    </>
  );
}
