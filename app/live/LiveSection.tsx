"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import LivePlayer from "@/components/LivePlayer";
import LiveStage, { LiveIdle } from "@/components/LiveStage";
import PlayLoader from "@/components/PlayLoader";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { DAY_NAMES, EMPTY_STREAMS, effectiveStart, isRunning, nextDayWithStream, nowPlaying, parseStreams, pickStream, type LiveStreams } from "@/lib/live";
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

function useVolume() {
  const [vol, setVol] = useState({ volume: 1, muted: false });
  useEffect(() => {
    try {
      const raw = localStorage.getItem("live-volume");
      if (raw) {
        const o = JSON.parse(raw) as { volume?: number; muted?: boolean };
        setVol({ volume: typeof o.volume === "number" ? Math.min(1, Math.max(0, o.volume)) : 1, muted: o.muted === true });
      }
    } catch {}
  }, []);
  const set = (volume: number, muted: boolean) => {
    setVol({ volume, muted });
    try { localStorage.setItem("live-volume", JSON.stringify({ volume, muted })); } catch {}
  };
  return [vol, set] as const;
}

export default function LiveSection() {
  const { settings } = useSettings();
  const [streams, setStreams] = useState<LiveStreams>(EMPTY_STREAMS);
  const [ready, setReady] = useState(!isFirebaseConfigured);

  // مستند واحد لكل بث (العام + أيام الأسبوع) + الإعداد: نستمع لكل المجموعة.
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onSnapshot(
      collection(getDb(), "live"),
      (snap) => {
        setStreams(parseStreams(snap.docs.map((d) => ({ id: d.id, data: d.data() }))));
        setReady(true);
      },
      () => setReady(true),
    );
  }, []);

  // نحدّث الوقت كل ثانية ما دام هناك بث فعّال في أي يوم (ليتبدّل البث عند منتصف الليل أيضًا).
  const anyRunning = isRunning(streams.current) || streams.days.some(isRunning);
  const now = useNow(anyRunning);
  const { live, day: today } = pickStream(streams, now);
  const running = isRunning(live);
  const [vol, setVol] = useVolume();

  if (!ready) return <div className="live-view" aria-busy="true"><div className="live-frame live-frame--wait"><PlayLoader show /></div></div>;

  const texts = streams.config.texts;
  const tz = streams.config.tz;
  if (running) {
    const startAt = effectiveStart(live, now, tz) as number;
    const np = nowPlaying(live.items, startAt, now, live.loop);
    if (np.state === "playing" || np.state === "waiting") {
      const cur = np.state === "playing" ? live.items[np.index] : null;
      return (
        <LiveStage
          texts={texts}
          title={live.title}
          items={live.items}
          loop={live.loop}
          np={np}
          startAt={startAt}
          now={now}
          tz={tz}
          player={cur && np.state === "playing" ? <LivePlayer key={`${np.index}-${cur.videoId}`} driveId={cur.driveId} title={cur.title} offset={np.offset} volume={vol.volume} muted={vol.muted} onVolume={setVol} /> : null}
        />
      );
    }
    if (np.state === "ended") {
      return <p>{texts.ended}</p>;
    }
  }

  if (settings.liveUrl) {
    return (
      <>
        <p>يوجد بث الآن.</p>
        <a className="btn" href={settings.liveUrl} target="_blank" rel="noopener noreferrer">شاهد البث</a>
      </>
    );
  }
  // في وضع أيام الأسبوع نذكر أقرب يوم له بث.
  const next = streams.config.mode === "weekly" ? nextDayWithStream(streams, today) : null;
  return <LiveIdle texts={texts} weekly={streams.config.mode === "weekly"} nextDay={next !== null ? DAY_NAMES[next] : null} />;
}
