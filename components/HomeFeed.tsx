"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SkeletonGrid } from "@/components/Skeleton";
import VideoGrid from "@/components/VideoGrid";
import { shuffled, viewsAndAge } from "@/lib/format";
import { useAllVideos, type VideoDoc } from "@/lib/videos";

const ROW = 4; // أربعة فيديوهات في الصف على الحاسوب
const TOP_ROWS = 2; // صفّان منتقيان قبل صف المقاطع القصيرة
const POOL = 16; // نختار من أحدث 16 ومن أكثر 16 مشاهدة
const SHORTS_IN_ROW = 10;

/**
 * الصفّان الأولان معًا (8 فيديوهات): 2 أو 3 من أحدث المنشور + 2 من الأكثر مشاهدة + الباقي عشوائي، كلها بترتيب عشوائي.
 * ثم بقية الفيديوهات بترتيب عشوائي. القائمة المدخلة مرتبة من الأحدث للأقدم.
 */
function layoutHome(regular: VideoDoc[]) {
  const newest = regular.slice(0, POOL);
  const popular = [...regular].sort((a, b) => b.views - a.views).slice(0, POOL);
  const used = new Set<string>();
  const take = (pool: VideoDoc[], n: number) => {
    const out: VideoDoc[] = [];
    for (const v of shuffled(pool)) {
      if (out.length >= n) break;
      if (!used.has(v.id)) {
        used.add(v.id);
        out.push(v);
      }
    }
    return out;
  };
  const size = ROW * TOP_ROWS;
  const picked = [...take(newest, Math.random() < 0.5 ? 2 : 3), ...take(popular, 2)];
  picked.push(...take(regular, size - picked.length));
  const top = shuffled(picked);
  const rest = shuffled(regular.filter((v) => !used.has(v.id)));
  return { top, rest };
}

/** صف المقاطع القصيرة: شريط أفقي قابل للتمرير يظهر بين الصفّين الأولين وبقية الفيديوهات. */
function ShortsRow({ items }: { items: readonly VideoDoc[] }) {
  if (items.length === 0) return null;
  return (
    <section className="home-shorts" aria-labelledby="home-shorts-title">
      <div className="home-shorts-head">
        <h2 id="home-shorts-title">مقاطع قصيرة</h2>
        <Link href="/shorts">عرض المزيد</Link>
      </div>
      <ul className="home-shorts-row">
        {items.map((v) => (
          <li key={v.id}>
            <Link href={`/v/${v.id}`} className="card">
              <div className="thumb" style={{ ["--h" as string]: (v.title.length * 47) % 360 }}>
                {v.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
              </div>
              <h3>{v.title}</h3>
              <p className="meta">{viewsAndAge(v.views, v.createdAt)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** الرئيسية: شريط تصنيفات، ثم صفّان (أحدث + أكثر مشاهدة)، فصف مقاطع قصيرة، فبقية الفيديوهات عشوائيًا. */
export default function HomeFeed({ emptyNote }: { emptyNote?: string }) {
  const { videos, ready } = useAllVideos();
  const [cat, setCat] = useState("");

  // نخلط مرة واحدة عند وصول البيانات (تغيير التصنيف لا يعيد الخلط).
  const home = useMemo(() => layoutHome(videos.filter((v) => !v.isShort)), [videos]);
  const shortsRow = useMemo(() => shuffled(videos.filter((v) => v.isShort)).slice(0, SHORTS_IN_ROW), [videos]);
  const pool = useMemo(() => [...home.top, ...home.rest], [home]);

  const cats = useMemo(() => {
    const m = new Map<string, { id: string; name: string; n: number }>();
    for (const v of pool) {
      if (!v.categoryId || !v.categoryName) continue;
      const c = m.get(v.categoryId) ?? { id: v.categoryId, name: v.categoryName, n: 0 };
      c.n += 1;
      m.set(v.categoryId, c);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "ar"));
  }, [pool]);

  const filtered = useMemo(() => (cat ? shuffled(pool.filter((v) => v.categoryId === cat)) : []), [pool, cat]);

  return (
    <section aria-label="الفيديوهات">
      {cats.length > 0 && (
        <div className="chips" role="tablist" aria-label="التصنيفات">
          <button type="button" role="tab" aria-selected={cat === ""} className={cat === "" ? "chip on" : "chip"} onClick={() => setCat("")}>
            الكل
          </button>
          {cats.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} className={cat === c.id ? "chip on" : "chip"} onClick={() => setCat(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {!ready ? (
        <SkeletonGrid />
      ) : cat ? (
        <VideoGrid items={filtered} className="grid--home" />
      ) : pool.length > 0 || shortsRow.length > 0 ? (
        <>
          <VideoGrid items={home.top} className="grid--home" all />
          <ShortsRow items={shortsRow} />
          {home.rest.length > 0 && <VideoGrid items={home.rest} className="grid--home" />}
        </>
      ) : emptyNote ? (
        <p className="empty-note">{emptyNote}</p>
      ) : null}
    </section>
  );
}
