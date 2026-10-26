"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { SkeletonSuggest } from "@/components/Skeleton";
import { formatClock, viewsAndAge } from "@/lib/format";
import { useHistory } from "@/lib/history";
import { useSettings, type WatchPageSettings } from "@/lib/settings";
import { toVideo, type VideoDoc } from "@/lib/videos";

const POOL = 80; // نقرأ أحدث 80 فيديو فقط (كل قراءة تُحتسب من حصة Firestore) ثم نختار منها حسب الإعدادات

const seKey = (v: Pick<VideoDoc, "season" | "episode">) => (v.season ?? 0) * 10_000 + (v.episode ?? 0);

/** «الموسم 2 • الحلقة 5» (أو أحدهما)، وفارغ إن لم يُحدَّد شيء. */
export function episodeLabel(v: Pick<VideoDoc, "season" | "episode">): string {
  return [v.season ? `الموسم ${v.season}` : "", v.episode ? `الحلقة ${v.episode}` : ""].filter(Boolean).join(" • ");
}

/**
 * يختار المقترحات من الفيديوهات المقروءة (مرتبة من الأحدث) حسب إعدادات «صفحة الفيديو».
 * rnd: رقم عشوائي ثابت لكل فيديو طوال بقاء الصفحة كي لا يتغيّر الترتيب العشوائي مع كل إعادة عرض.
 */
export function pickSuggestions(pool: readonly VideoDoc[], current: VideoDoc, w: WatchPageSettings, done: ReadonlySet<string>, rnd: (id: string) => number): VideoDoc[] {
  let list = pool.filter((v) => v.id !== current.id && !v.hidden && (w.sugShorts || !v.isShort) && !(w.sugHideWatched && done.has(v.id)));

  // النطاق: نفس المجموعة/التصنيف فقط. إن لم يوجد شيء نكمل بالبقية كي لا يظهر القسم فارغًا.
  const scoped =
    w.sugScope === "series" && current.seriesId ? list.filter((v) => v.seriesId === current.seriesId)
    : w.sugScope === "category" && current.categoryId ? list.filter((v) => v.categoryId === current.categoryId)
    : null;
  if (scoped && scoped.length > 0) list = scoped;

  const score = (v: VideoDoc) =>
    (w.sugPrioSeries && current.seriesId && v.seriesId === current.seriesId ? 2 : 0) +
    (w.sugPrioCategory && current.categoryId && v.categoryId === current.categoryId ? 1 : 0);
  // الفرز مستقر: عند تساوي النقاط يبقى الترتيب من الأحدث.
  const ranked = list.map((v, i) => ({ v, i })).sort((a, b) => score(b.v) - score(a.v) || a.i - b.i).map((x) => x.v);
  const byRandom = (a: VideoDoc, b: VideoDoc) => rnd(a.id) - rnd(b.id);

  let out: VideoDoc[];
  switch (w.sugOrder) {
    case "related":
      out = ranked;
      break;
    case "newest":
      out = list;
      break;
    case "popular":
      out = [...list].sort((a, b) => b.views - a.views);
      break;
    case "random":
      out = [...list].sort(byRandom);
      break;
    default: {
      const n = Math.min(w.sugRelated, w.sugCount);
      out = [...ranked.slice(0, n), ...ranked.slice(n).sort(byRandom)];
    }
  }

  if (w.sugNextFirst && current.seriesId && (current.season || current.episode)) {
    const cur = seKey(current);
    const next = pool
      .filter((v) => v.id !== current.id && !v.hidden && v.seriesId === current.seriesId && (v.season || v.episode) && seKey(v) > cur && !(w.sugHideWatched && done.has(v.id)))
      .sort((a, b) => seKey(a) - seKey(b))[0];
    if (next) out = [next, ...out.filter((v) => v.id !== next.id)];
  }
  return out.slice(0, w.sugCount);
}

function Thumb({ v, showDuration }: { v: VideoDoc; showDuration: boolean }) {
  return (
    <span className="sug-thumb">
      {v.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
      )}
      {showDuration && v.duration && <span className="dur">{formatClock(v.duration)}</span>}
    </span>
  );
}

/** فيديوهات مقترحة حسب «لوحة التحكم ← التنظيم ← صفحة الفيديو». القائمة تتمرّر باستقلالية على الشاشات الكبيرة. */
export default function SuggestedVideos({ current }: { current: VideoDoc }) {
  const { settings } = useSettings();
  const w = settings.watchPage;
  const [pool, setPool] = useState<VideoDoc[]>([]);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const history = useHistory();
  const rndMap = useRef(new Map<string, number>());
  const rnd = (id: string) => {
    let n = rndMap.current.get(id);
    if (n === undefined) rndMap.current.set(id, (n = Math.random()));
    return n;
  };

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(POOL)))
      .then((snap) => !off && setPool(snap.docs.map((d) => toVideo(d.id, d.data()))))
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, []);

  const doneKey = history.filter((e) => e.done).map((e) => e.id).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => pickSuggestions(pool, current, w, new Set(doneKey ? doneKey.split(",") : []), rnd), [pool, current, w, doneKey]);

  if (!w.sugShow) return null;

  const body = (v: VideoDoc) => (
    <>
      <Thumb v={v} showDuration={w.sugShowDuration} />
      <span className="sug-info">
        <strong>{v.title}</strong>
        {w.sugShowSeries && v.seriesName && <small>{v.seriesName}</small>}
        {w.sugShowEpisode && episodeLabel(v) && <small>{episodeLabel(v)}</small>}
        {w.sugShowViews && <small>{viewsAndAge(v.views, v.createdAt)}</small>}
      </span>
    </>
  );

  return (
    <aside className="suggest" aria-labelledby={w.sugTitle ? "sug-title" : undefined} aria-label={w.sugTitle ? undefined : "فيديوهات مقترحة"}>
      {w.sugTitle && <h2 id="sug-title">{w.sugTitle}</h2>}
      {!ready ? (
        <SkeletonSuggest />
      ) : items.length === 0 ? (
        <p className="empty-note">لا توجد فيديوهات أخرى بعد.</p>
      ) : (
        <div className={`suggest-scroll suggest-scroll--${w.sugLayout}`} tabIndex={0} role="region" aria-label="قائمة الفيديوهات المقترحة">
          <ul className={`suggest-list suggest-list--${w.sugLayout}`}>
            {items.map((v) => (
              <li key={v.id}>
                <Link href={`/v/${v.id}`} className={w.sugLayout === "list" ? "sug" : "sug sug--card"}>
                  {body(v)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
