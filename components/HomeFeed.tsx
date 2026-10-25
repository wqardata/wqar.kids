"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SkeletonGrid } from "@/components/Skeleton";
import VideoGrid from "@/components/VideoGrid";
import { shuffled, viewsAndAge } from "@/lib/format";
import { SHORTS_POS_END, useSettings, type DisplaySettings } from "@/lib/settings";
import { useAllVideos, type VideoDoc } from "@/lib/videos";

const ROW = 4; // أربعة فيديوهات في الصف على الحاسوب
const POOL = 16; // في الوضع العشوائي نختار من أحدث 16 ومن أكثر 16 مشاهدة (أو ضعف العدد المطلوب إن كان أكبر)
const SHORTS_IN_ROW = 10;

type Layout = { top: VideoDoc[]; rest: VideoDoc[] };

/**
 * المجموعة الأولى (top): عدد الجديد + عدد الأكثر مشاهدة، وتُكمَل خانات آخر صف فيها بفيديوهات أخرى.
 * ثم بقية الفيديوهات (rest). القائمة المدخلة مرتبة من الأحدث للأقدم.
 * عشوائي: الاختيار والعرض بخلط جديد في كل زيارة. ترتيب: الجديد ثم الأكثر مشاهدة ثم البقية من الأحدث للأقدم.
 */
function layoutHome(regular: VideoDoc[], d: Pick<DisplaySettings, "newCount" | "popularCount" | "homeOrder">): Layout {
  const ordered = d.homeOrder === "ordered";
  const want = d.newCount + d.popularCount;
  const size = Math.ceil(want / ROW) * ROW;
  const used = new Set<string>();
  const take = (pool: VideoDoc[], n: number) => {
    const out: VideoDoc[] = [];
    for (const v of ordered ? pool : shuffled(pool)) {
      if (out.length >= n) break;
      if (!used.has(v.id)) {
        used.add(v.id);
        out.push(v);
      }
    }
    return out;
  };
  const newest = regular.slice(0, Math.max(POOL, d.newCount * 2));
  const popular = [...regular].sort((a, b) => b.views - a.views).slice(0, Math.max(POOL, d.popularCount * 2));
  let top = [...take(newest, d.newCount), ...take(popular, d.popularCount)];
  top.push(...take(regular, size - top.length));
  if (!ordered) top = shuffled(top);
  const rest = regular.filter((v) => !used.has(v.id));
  return { top, rest: ordered ? rest : shuffled(rest) };
}

type Seg = { kind: "grid"; key: string; items: VideoDoc[]; title: string; paged: boolean } | { kind: "shorts"; key: string };

/**
 * يقسّم القائمة إلى أجزاء متتالية: عنوان المجموعة الأولى قبل أول صف، وعنوان البقية قبل أول صف منها،
 * وصف المقاطع القصيرة عند موضعه المحدّد (بعد الصف رقم n). آخر شبكة فقط تُحمَّل تدريجيًا حين تكون الصفوف غير محدودة.
 */
function buildSegments(home: Layout, d: DisplaySettings, hasShorts: boolean): Seg[] {
  const limit = d.homeRows > 0 ? d.homeRows * ROW : 0;
  const list = limit ? [...home.top, ...home.rest].slice(0, limit) : [...home.top, ...home.rest];
  const topN = Math.min(home.top.length, list.length);
  const shortsAt = !hasShorts ? -1 : d.shortsPos >= SHORTS_POS_END ? list.length : Math.min(d.shortsPos * ROW, list.length);

  const cuts = new Set<number>([0, list.length]);
  if (topN > 0 && topN < list.length) cuts.add(topN);
  if (shortsAt > 0 && shortsAt < list.length) cuts.add(shortsAt);
  const points = [...cuts].sort((a, b) => a - b);

  const segs: Seg[] = [];
  const pagedFromEnd = limit === 0;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    if (shortsAt === from) segs.push({ kind: "shorts", key: "shorts" });
    const title = topN > 0 && from === 0 ? d.titleTop : from === topN ? d.titleRest : "";
    segs.push({ kind: "grid", key: `g${from}`, items: list.slice(from, to), title, paged: pagedFromEnd && i === points.length - 2 });
  }
  if (shortsAt === list.length) segs.push({ kind: "shorts", key: "shorts" });
  return segs;
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

/** الرئيسية: شريط تصنيفات، ثم مجموعات الصفوف وصف المقاطع القصيرة حسب «إعدادات العرض» في لوحة التحكم. */
export default function HomeFeed({ emptyNote }: { emptyNote?: string }) {
  const { videos, ready } = useAllVideos();
  const { settings } = useSettings();
  const disp = settings.display;
  const [cat, setCat] = useState("");

  // نخلط مرة واحدة عند وصول البيانات (تغيير التصنيف لا يعيد الخلط).
  const home = useMemo(
    () => layoutHome(videos.filter((v) => !v.isShort), { newCount: disp.newCount, popularCount: disp.popularCount, homeOrder: disp.homeOrder }),
    [videos, disp.newCount, disp.popularCount, disp.homeOrder],
  );
  const shortsRow = useMemo(() => shuffled(videos.filter((v) => v.isShort)).slice(0, SHORTS_IN_ROW), [videos]);
  const pool = useMemo(() => [...home.top, ...home.rest], [home]);
  const segments = useMemo(() => buildSegments(home, disp, disp.shortsShow && shortsRow.length > 0), [home, disp, shortsRow.length]);

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
      ) : segments.length > 0 ? (
        <>
          {segments.map((seg) =>
            seg.kind === "shorts" ? (
              <ShortsRow key={seg.key} items={shortsRow} />
            ) : (
              <div key={seg.key}>
                {seg.title && <h2 className="home-group-title">{seg.title}</h2>}
                <VideoGrid items={seg.items} className="grid--home" all={!seg.paged} />
              </div>
            ),
          )}
        </>
      ) : emptyNote ? (
        <p className="empty-note">{emptyNote}</p>
      ) : null}
    </section>
  );
}
