import Link from "next/link";
import { formatClock } from "@/lib/format";
import type { VideoDoc } from "@/lib/videos";

/** شبكة بطاقات لفيديوهات Firestore. */
export default function VideoGrid({ items, shorts = false }: { items: readonly VideoDoc[]; shorts?: boolean }) {
  return (
    <ul className={shorts ? "grid grid--shorts" : "grid"}>
      {items.map((v, i) => (
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
          </Link>
        </li>
      ))}
    </ul>
  );
}
