"use client";
import { useMemo, useState } from "react";
import { SkeletonGrid } from "@/components/Skeleton";
import VideoGrid from "@/components/VideoGrid";
import { useAllVideos, type VideoDoc } from "@/lib/videos";

/**
 * ترتيب عشوائي مرجَّح: كل فيديو له وزن أعلى إن كان حديثًا أو كثير المشاهدة (1 إلى 5)،
 * ثم نرتّب بمفتاح عشوائي u^(1/w) (طريقة Efraimidis–Spirakis). النتيجة: ترتيب مختلف في كل زيارة،
 * لكن الجديد والأكثر مشاهدة يظهران في المقدمة أكثر من غيرهما «أحيانًا» لا دائمًا.
 */
function weightedShuffle(list: VideoDoc[]): VideoDoc[] {
  const now = Date.now();
  const maxViews = Math.max(1, ...list.map((v) => v.views));
  return list
    .map((v) => {
      const ageDays = v.createdAt ? Math.max(0, now - v.createdAt) / 86_400_000 : 30;
      const fresh = Math.exp(-ageDays / 7); // 1 للجديد جدًا ← 0 للقديم
      const pop = Math.log1p(v.views) / Math.log1p(maxViews); // 0..1
      const w = 1 + 2 * fresh + 2 * pop;
      return { v, k: Math.pow(Math.random(), 1 / w) };
    })
    .sort((a, b) => b.k - a.k)
    .map((x) => x.v);
}

/** الرئيسية: شريط تصنيفات أعلى الفيديوهات + فيديوهات بترتيب عشوائي مرجَّح. */
export default function HomeFeed({ emptyNote }: { emptyNote?: string }) {
  const { videos, ready } = useAllVideos();
  const [cat, setCat] = useState("");

  // نخلط مرة واحدة عند وصول البيانات (تغيير التصنيف لا يعيد الخلط).
  const shuffled = useMemo(() => weightedShuffle(videos.filter((v) => !v.isShort)), [videos]);

  const cats = useMemo(() => {
    const m = new Map<string, { id: string; name: string; n: number }>();
    for (const v of shuffled) {
      if (!v.categoryId || !v.categoryName) continue;
      const c = m.get(v.categoryId) ?? { id: v.categoryId, name: v.categoryName, n: 0 };
      c.n += 1;
      m.set(v.categoryId, c);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "ar"));
  }, [shuffled]);

  const items = cat ? shuffled.filter((v) => v.categoryId === cat) : shuffled;

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
      {!ready ? <SkeletonGrid /> : items.length > 0 ? <VideoGrid items={items} /> : emptyNote ? <p className="empty-note">{emptyNote}</p> : null}
    </section>
  );
}
