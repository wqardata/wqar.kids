"use client";
import { useMemo, useState } from "react";
import LiveStage, { LiveIdle } from "@/components/LiveStage";
import { DAY_NAMES, type LiveItem, type LiveTexts, type NowPlaying } from "@/lib/live";

export type Scenario = "playing" | "waiting" | "idle" | "idle-weekly" | "ended";
const LABELS: Record<Scenario, string> = {
  playing: "أثناء البث",
  waiting: "قبل موعد البدء",
  idle: "لا يوجد بث",
  "idle-weekly": "لا يوجد بث اليوم",
  ended: "انتهى البث",
};

/** عيّنة تُستعمل حين تكون القائمة فارغة، لتبقى المعاينة مفيدة. */
export const SAMPLE_ITEMS: LiveItem[] = [
  { videoId: "s1", title: "المقطع الأول (مثال)", driveId: "x", thumbnail: "", duration: 1500 },
  { videoId: "s2", title: "المقطع الثاني (مثال)", driveId: "x", thumbnail: "", duration: 1800 },
  { videoId: "s3", title: "المقطع الثالث (مثال)", driveId: "x", thumbnail: "", duration: 1200 },
];

type Props = {
  texts: LiveTexts;
  tz: string;
  title: string;
  items: readonly LiveItem[];
  loop: boolean;
  /** موعد البدء الذي اختاره المشرف (إن كان في المستقبل يُستعمل في معاينة «قبل الموعد»). */
  startAt?: number | null;
  scenarios?: Scenario[];
  heading?: string;
};

/** معاينة لما سيراه الزائر، تُحدَّث لحظيًا أثناء التعديل ولا تحفظ شيئًا. */
export default function LivePreview({ texts, tz, title, items, loop, startAt, scenarios = ["playing", "waiting", "ended"], heading = "معاينة قبل الحفظ" }: Props) {
  const [scenario, setScenario] = useState<Scenario>(scenarios[0]);
  const [now] = useState(() => Date.now());
  const list = items.length ? items : SAMPLE_ITEMS;
  const sample = items.length === 0;
  const shown: Scenario = scenarios.includes(scenario) ? scenario : scenarios[0];

  const np = useMemo<NowPlaying | null>(() => {
    if (shown === "playing") {
      const d = list[0].duration || 600;
      return { state: "playing", index: 0, offset: Math.round(d * 0.35), remaining: Math.round(d * 0.65) };
    }
    if (shown === "waiting") return { state: "waiting", startsIn: Math.max(1, Math.round(((startAt && startAt > now ? startAt : now + 5_400_000) - now) / 1000)) };
    return null;
  }, [shown, list, startAt, now]);
  const at = startAt && startAt > now ? startAt : now + 5_400_000;

  return (
    <section className="live-preview" aria-label={heading}>
      <header>
        <strong>{heading}</strong>
        <div className="addrow" role="group" aria-label="حالة العرض">
          {scenarios.map((s) => (
            <button key={s} type="button" className={`btn btn--sm ${shown === s ? "" : "btn--ghost"}`} aria-pressed={shown === s} onClick={() => setScenario(s)}>
              {LABELS[s]}
            </button>
          ))}
        </div>
      </header>
      {sample && (shown === "playing" || shown === "waiting") && <p className="hint">القائمة فارغة فتظهر عيّنة من مقاطع تجريبية.</p>}
      {np && (np.state === "playing" || np.state === "waiting") && (
        <LiveStage
          texts={texts}
          title={title}
          items={list}
          loop={loop}
          np={np}
          startAt={at}
          now={now}
          tz={tz}
          player={<div className="live-frame--mock" aria-hidden="true">مكان المشغّل</div>}
        />
      )}
      {shown === "idle" && <LiveIdle texts={texts} weekly={false} nextDay={null} />}
      {shown === "idle-weekly" && <LiveIdle texts={texts} weekly nextDay={DAY_NAMES[5]} />}
      {shown === "ended" && <p>{texts.ended}</p>}
    </section>
  );
}
