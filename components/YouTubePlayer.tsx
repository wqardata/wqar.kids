"use client";
import { useEffect, useState } from "react";
import "@/app/player.css";
import PlayLoader from "@/components/PlayLoader";
import { YT_ID } from "@/lib/youtube";

/** مشغّل يوتيوب الرسمي (iframe من youtube-nocookie). لا يمرّ على خادم الموقع. */
export default function YouTubePlayer({ youtubeId, title, autoplay = false, startAt = 0 }: { youtubeId: string; title: string; autoplay?: boolean; startAt?: number }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const t = setTimeout(() => setLoaded(true), 15_000); // احتياط إن لم يصل حدث التحميل
    return () => clearTimeout(t);
  }, [youtubeId]);

  if (!YT_ID.test(youtubeId)) {
    return <div className="player" role="img" aria-label={`الفيديو غير متوفر — ${title}`}><span className="soon">الفيديو غير متوفر</span></div>;
  }
  const q = new URLSearchParams({ rel: "0", playsinline: "1", modestbranding: "1" });
  if (autoplay) q.set("autoplay", "1");
  if (startAt >= 1) q.set("start", String(Math.floor(startAt)));
  return (
    <div className="player player--frame dp-frame">
      <iframe
        key={youtubeId}
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?${q}`}
        title={`مشغّل يوتيوب — ${title}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
      />
      <PlayLoader show={!loaded} />
    </div>
  );
}
