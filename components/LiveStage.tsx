import type { ReactNode } from "react";
import { formatClock, viewsLabel } from "@/lib/format";
import { describeStart, fillTemplate, formatTotal, totalSeconds, type LiveItem, type LiveTexts, type NowPlaying } from "@/lib/live";

type Props = {
  texts: LiveTexts;
  title: string;
  items: readonly LiveItem[];
  loop: boolean;
  /** يجب أن تكون الحالة «playing» أو «waiting». */
  np: Extract<NowPlaying, { state: "playing" | "waiting" }>;
  /** لحظة بدء البث (لعرض موعده أثناء الانتظار). */
  startAt: number | null;
  now: number;
  tz: string;
  /** المشغّل الحقيقي في صفحة البث، أو مكان محجوز في المعاينة. */
  player: ReactNode;
  /** مشاهدات المقطع الجاري (null/غير موجود = لا يُعرض). */
  views?: number | null;
};

/**
 * عرض البث للزائر (الشارة، المقطع الحالي، سطر التقدّم، قائمة الجدول).
 * تستعمله صفحة «بث مباشر» نفسها ومعاينة لوحة التحكم، فتطابق المعاينة ما سيراه الزائر تمامًا.
 */
export default function LiveStage({ texts, title, items, loop, np, startAt, now, tz, player, views }: Props) {
  const waiting = np.state === "waiting";
  const badge = `${texts.badge}${title ? ` — ${title}` : ""}`;
  return (
    <div className="live-view">
      <p className={waiting ? "live-badge live-badge--wait" : "live-badge"} role="status"><span className={waiting ? "live-dot" : "live-dot live-dot--on"} aria-hidden="true">{waiting ? "◔" : "●"}</span> {badge}</p>
      {np.state === "playing" ? (
        <>
          {player}
          {typeof views === "number" && <p className="live-views" aria-label="المشاهدات">{viewsLabel(views)}</p>}
          <h2 className="live-now">{items[np.index].title}</h2>
          <p className="live-meta">
            {fillTemplate(texts.metaNow, { elapsed: formatClock(np.offset), duration: formatClock(items[np.index].duration), n: np.index + 1, count: items.length })}
            {(loop || np.index + 1 < items.length) &&
              fillTemplate(texts.metaNext, { next: items[(np.index + 1) % items.length].title, remaining: formatClock(np.remaining) })}
          </p>
        </>
      ) : (
        <p className="live-wait" role="status">
          {fillTemplate(texts.waiting, {
            time: startAt === null ? "" : describeStart(startAt, now, tz),
            countdown: formatTotal(np.startsIn),
          })}
        </p>
      )}
      <h3 className="live-h">{texts.scheduleHeading} ({formatTotal(totalSeconds(items))})</h3>
      <ol className="live-queue">
        {items.map((it, i) => {
          const on = np.state === "playing" && i === np.index;
          return (
            <li key={`${it.videoId}-${i}`} aria-current={on ? "true" : undefined} className={on ? "on" : undefined}>
              <span>{it.title}</span>
              <small>{formatClock(it.duration)}</small>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** رسالة «لا يوجد بث». `nextDay` = اسم أقرب يوم له بث (نمط أيام الأسبوع) أو null. */
export function LiveIdle({ texts, weekly, nextDay }: { texts: LiveTexts; weekly: boolean; nextDay: string | null }) {
  return (
    <p>
      {weekly ? texts.noLiveToday : texts.noLive}{" "}
      {nextDay !== null ? fillTemplate(texts.nextDay, { day: nextDay }) : texts.nextUnknown}
    </p>
  );
}
