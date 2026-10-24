"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import DrivePlayer from "@/components/DrivePlayer";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { formatClock } from "@/lib/format";
import { EMPTY_LIVE, formatTotal, nowPlaying, parseLive, type LiveDoc } from "@/lib/live";
import { useSettings } from "@/lib/settings";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** المشغّل يُثبَّت بنقطة البدء عند تركيبه فقط، كي لا يُعاد تحميله كل ثانية مع تغيّر الوقت. */
function LivePlayer({ driveId, title, offset }: { driveId: string; title: string; offset: number }) {
  const [startAt] = useState(offset);
  return <DrivePlayer driveId={driveId} title={title} hue={160} autoplay startAt={startAt} />;
}

export default function LiveSection() {
  const { settings } = useSettings();
  const [live, setLive] = useState<LiveDoc>(EMPTY_LIVE);
  const [ready, setReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onSnapshot(
      doc(getDb(), "live", "current"),
      (snap) => {
        setLive(parseLive(snap.exists() ? snap.data() : undefined));
        setReady(true);
      },
      () => setReady(true),
    );
  }, []);

  const running = live.active && live.startedAt !== null && live.items.length > 0;
  const now = useNow(running);

  if (!ready) return <p role="status">جارٍ التحميل…</p>;

  if (running) {
    const np = nowPlaying(live.items, live.startedAt as number, now, live.loop);
    if (np.state === "playing") {
      const cur = live.items[np.index];
      const next = live.items[(np.index + 1) % live.items.length];
      const hasNext = live.loop || np.index + 1 < live.items.length;
      return (
        <div className="live-view">
          <p className="live-badge" role="status">● بث مباشر{live.title ? ` — ${live.title}` : ""}</p>
          <LivePlayer key={`${np.index}-${cur.videoId}`} driveId={cur.driveId} title={cur.title} offset={np.offset} />
          <h2 className="live-now">{cur.title}</h2>
          <p className="live-meta">
            مضى {formatClock(np.offset)} من {formatClock(cur.duration)} • المقطع {np.index + 1} من {live.items.length}
            {hasNext && ` • التالي: ${next.title} بعد ${formatClock(np.remaining)}`}
          </p>
          <h3 className="live-h">جدول البث ({formatTotal(live.items.reduce((n, i) => n + i.duration, 0))})</h3>
          <ol className="live-queue">
            {live.items.map((it, i) => (
              <li key={`${it.videoId}-${i}`} aria-current={i === np.index ? "true" : undefined} className={i === np.index ? "on" : undefined}>
                <span>{it.title}</span>
                <small>{formatClock(it.duration)}</small>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    if (np.state === "ended") {
      return <p>انتهى البث. تابعنا لمعرفة موعد البث القادم.</p>;
    }
  }

  return settings.liveUrl ? (
    <>
      <p>يوجد بث الآن.</p>
      <a className="btn" href={settings.liveUrl} target="_blank" rel="noopener noreferrer">شاهد البث</a>
    </>
  ) : (
    <p>لا يوجد بث مباشر حاليًا. تابعنا لمعرفة موعد البث القادم.</p>
  );
}
