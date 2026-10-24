"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import DrivePlayer from "@/components/DrivePlayer";
import type { VideoDoc } from "@/lib/videos";

type Props = {
  driveId: string;
  title: string;
  clip: NonNullable<VideoDoc["clip"]>;
  /** يعمل التشغيل التلقائي فقط حين يكون true (المقطع الحالي في التمرير). */
  active?: boolean;
};

/**
 * مشغّل المقاطع المقتطعة: يشغّل الجزء [start, end] فقط من الملف الأصلي ويكرّره،
 * ويملأ الإطار الطولي بقصّ أفقي عند الموضع clip.x. إن تعذّر التشغيل المباشر نعود لمشغّل درايف مقصوصًا بالـCSS.
 */
export default function ClipPlayer({ driveId, title, clip, active = true }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const begin = useCallback(async () => {
    const v = ref.current;
    if (!v) return;
    if (v.currentTime < clip.start - 0.3 || v.currentTime >= clip.end) v.currentTime = clip.start;
    v.muted = false;
    try {
      await v.play();
      setMuted(false);
    } catch {
      // المتصفح يمنع التشغيل بصوت قبل أي تفاعل: نبدأ صامتين ونعرض زر الصوت.
      v.muted = true;
      setMuted(true);
      void v.play().catch(() => {});
    }
  }, [clip.start, clip.end]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      if (v.readyState >= 1) void begin();
    } else v.pause();
  }, [active, begin]);

  // نتحقق من النهاية كل إطار أثناء التشغيل (حدث timeupdate بطيء ويتجاوز النهاية بربع ثانية).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = ref.current;
      if (v && v.currentTime >= clip.end) v.currentTime = clip.start;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, clip.start, clip.end]);

  if (failed) {
    return (
      <div className="clip-fallback" style={{ "--cx": clip.x } as CSSProperties}>
        <div className="clip-fallback-inner">
          <DrivePlayer driveId={driveId} title={title} hue={160} autoplay={active} startAt={clip.start} />
        </div>
      </div>
    );
  }

  return (
    <div className="clip-player">
      <video
        ref={ref}
        src={`/api/clip-video?id=${encodeURIComponent(driveId)}`}
        title={title}
        playsInline
        preload="auto"
        style={{ objectPosition: `${clip.x * 100}% 50%` }}
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = clip.start;
          if (active) void begin();
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.currentTime >= clip.end || v.currentTime < clip.start - 0.5) v.currentTime = clip.start;
        }}
        onEnded={(e) => {
          e.currentTarget.currentTime = clip.start;
          void e.currentTarget.play().catch(() => {});
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        onClick={(e) => {
          const v = e.currentTarget;
          if (v.paused) void begin();
          else v.pause();
        }}
      />
      {!playing && active && <span className="clip-state" aria-hidden="true">▶</span>}
      {muted && playing && (
        <button
          type="button"
          className="clip-unmute"
          onClick={() => {
            const v = ref.current;
            if (v) v.muted = false;
            setMuted(false);
          }}
        >
          🔇 اضغط لتشغيل الصوت
        </button>
      )}
    </div>
  );
}
