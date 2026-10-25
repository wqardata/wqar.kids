"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SkeletonGrid } from "@/components/Skeleton";
import VideoGrid from "@/components/VideoGrid";
import { NewList } from "@/components/NewVideos";
import RowIcon, { RowTitle } from "@/components/RowIcon";
import VideoCaption from "@/components/VideoCaption";
import { shuffled } from "@/lib/format";
import { HOME_TAB_DEFAULT_LABEL, SHORTS_POS_END, useSettings, type DisplaySettings } from "@/lib/settings";
import { useHistory } from "@/lib/history";
import { formatClock } from "@/lib/format";
import { useAllVideos, useSeriesAvatars, useVideosByIds, type VideoDoc } from "@/lib/videos";

const ROW = 4; // أربعة فيديوهات في الصف على الحاسوب
const POOL = 16; // في الوضع العشوائي نختار من أحدث 16 ومن أكثر 16 مشاهدة (أو ضعف العدد المطلوب إن كان أكبر)
const SHORTS_IN_ROW = 10;
const HISTORY_FETCH = 30; // نجلب حتى 30 فيديو من السجل ثم نصفّي (المقاطع القصيرة والمحذوف) ونأخذ العدد المطلوب

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

type Seg = { kind: "grid"; key: string; items: VideoDoc[]; title: string; group: 1 | 2; paged: boolean } | { kind: "shorts"; key: string };

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
    segs.push({ kind: "grid", key: `g${from}`, items: list.slice(from, to), title, group: topN > 0 && from < topN ? 1 : 2, paged: pagedFromEnd && i === points.length - 2 });
  }
  if (shortsAt === list.length) segs.push({ kind: "shorts", key: "shorts" });
  return segs;
}

/** صف المقاطع القصيرة: شريط أفقي قابل للتمرير يظهر في الموضع المحدّد من «إعدادات العرض». */
function ShortsRow({ items, title, icon }: { items: readonly VideoDoc[]; title: string; icon: string }) {
  const avatars = useSeriesAvatars();
  if (items.length === 0) return null;
  return (
    <section className="home-shorts" aria-label={title || "مقاطع قصيرة"}>
      <div className="home-shorts-head">
        {title ? (
          <h2 id="home-shorts-title" className="row-title">
            {icon && <span className="row-title-ic"><RowIcon id={icon} size={22} /></span>}
            <span>{title}</span>
          </h2>
        ) : (
          <span />
        )}
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
              <VideoCaption v={v} avatars={avatars} size={28} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * صف «تابع المشاهدة»: آخر فيديوهات (غير القصيرة) بدأ الزائر مشاهدتها ولم تكتمل، من سجل متصفحه.
 * إمّا شريط أفقي قابل للتمرير أو شبكة صفوف حسب «إعدادات العرض».
 */
function ContinueRow({ d }: { d: DisplaySettings }) {
  const entries = useHistory();
  const avatars = useSeriesAvatars();
  // كل ما سبق فتحه ولم يكتمل (الأحدث أولًا). الحد الأدنى للمشاهدة قابل للضبط من لوحة التحكم (0 = أي فيديو سبق فتحه).
  const candidates = useMemo(
    () => entries.filter((e) => !e.done && (e.watched ?? 0) >= d.continueMinSec).slice(0, HISTORY_FETCH),
    [entries, d.continueMinSec],
  );
  const { videos } = useVideosByIds(candidates.map((e) => e.id));
  const items = useMemo(() => {
    const by = new Map(videos.map((v) => [v.id, v] as const));
    return candidates.map((e) => by.get(e.id)).filter((v): v is VideoDoc => Boolean(v) && !v!.isShort).slice(0, d.continueCount);
  }, [candidates, videos, d.continueCount]);
  if (items.length === 0) return null;
  return (
    <section className="home-continue" aria-label={d.continueTitle || "تابع المشاهدة"}>
      <RowTitle text={d.continueTitle} icon={d.iconContinue} />
      {d.continueLayout === "rows" ? (
        <VideoGrid items={items} className="grid--home" all />
      ) : (
        <ul className="cont-row">
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
                <VideoCaption v={v} avatars={avatars} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** الرئيسية: شريط تصنيفات، ثم مجموعات الصفوف وصف المقاطع القصيرة حسب «إعدادات العرض» في لوحة التحكم. */
export default function HomeFeed({ emptyNote }: { emptyNote?: string }) {
  const { videos, ready } = useAllVideos();
  const { settings } = useSettings();
  const disp = settings.display;
  // التبويب المختار (معرّف: "all" | "new" | "cat:…")؛ null = الأول في القائمة.
  const [picked, setPicked] = useState<string | null>(null);

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

  // تبويبات أعلى الصفحة: تلقائية (الكل والجديد وكل التصنيفات) أو كما رتّبها المشرف من «إعدادات العرض».
  const tabs = useMemo<{ id: string; label: string }[]>(() => {
    if (!disp.homeTabsCustom) {
      return [{ id: "all", label: HOME_TAB_DEFAULT_LABEL.all }, { id: "new", label: HOME_TAB_DEFAULT_LABEL.new }, ...cats.map((c) => ({ id: `cat:${c.id}`, label: c.name }))];
    }
    const live = new Map(cats.map((c) => [c.id, c.name] as const));
    return disp.homeTabs
      .map((t) => ({ id: t.id, label: t.label || (t.id.startsWith("cat:") ? live.get(t.id.slice(4)) || t.name : HOME_TAB_DEFAULT_LABEL[t.id] ?? "") }))
      .filter((t) => t.label);
  }, [disp.homeTabsCustom, disp.homeTabs, cats]);
  const current = picked && tabs.some((t) => t.id === picked) ? picked : tabs[0]?.id ?? "all";
  const isNew = current === "new";
  const cat = current.startsWith("cat:") ? current.slice(4) : "";

  const filtered = useMemo(() => (cat ? shuffled(pool.filter((v) => v.categoryId === cat)) : []), [pool, cat]);

  return (
    <section aria-label="الفيديوهات">
      {tabs.length > 0 && (cats.length > 0 || videos.length > 0 || disp.homeTabsCustom) && (
        <div className="chips" role="tablist" aria-label="التصنيفات">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={current === t.id} className={current === t.id ? "chip on" : "chip"} onClick={() => setPicked(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {!ready ? (
        <SkeletonGrid />
      ) : isNew ? (
        <NewList videos={videos} ready={ready} />
      ) : cat ? (
        filtered.length > 0 ? <VideoGrid items={filtered} className="grid--home" /> : <p className="empty-note">لا توجد فيديوهات في هذا التصنيف حاليًا.</p>
      ) : segments.length > 0 || pool.length > 0 ? (
        <div className="home-blocks">
          {disp.continueShow && <ContinueRow d={disp} />}
          {segments.map((seg) =>
            seg.kind === "shorts" ? (
              <ShortsRow key={seg.key} items={shortsRow} title={disp.shortsTitle} icon={disp.iconShorts} />
            ) : (
              <div key={seg.key}>
                <RowTitle text={seg.title} icon={seg.group === 1 ? disp.iconTop : disp.iconRest} />
                <VideoGrid items={seg.items} className="grid--home" all={!seg.paged} />
              </div>
            ),
          )}
        </div>
      ) : emptyNote ? (
        <p className="empty-note">{emptyNote}</p>
      ) : null}
    </section>
  );
}
