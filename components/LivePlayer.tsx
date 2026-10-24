"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import DrivePlayer from "@/components/DrivePlayer";

type Props = {
  driveId: string;
  title: string;
  /** الموضع الحالي المفروض بالثواني (يتجدد كل ثانية؛ المشغّل لا يُعاد تحميله). */
  offset: number;
  volume: number;
  muted: boolean;
  onVolume: (volume: number, muted: boolean) => void;
};

const DRIFT_LIMIT = 4; // ثوانٍ: أكثر من هذا نعيد المزامنة مع وقت البث

/**
 * مشغّل البث المباشر: لا يمكن إيقافه ولا التقديم فيه (لا شريط تقدّم ولا زر إيقاف)، والمتاح هو الصوت وملء الشاشة فقط.
 * إن تعذّر تشغيل الفيديو مباشرة نعود إلى مشغّل درايف مع حاجز شفاف فوقه يمنع النقر عليه.
 */
export default function LivePlayer({ driveId, title, offset, volume, muted, onVolume }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const expected = useRef(offset);
  expected.current = offset;
  const [startAt] = useState(offset);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false); // المتصفح منع التشغيل بالصوت

  const sync = useCallback(() => {
    const v = ref.current;
    if (!v || !Number.isFinite(v.duration)) return;
    const want = Math.min(expected.current, Math.max(0, v.duration - 0.5));
    if (Math.abs(v.currentTime - want) > DRIFT_LIMIT) v.currentTime = want;
  }, []);

  const start = useCallback(async () => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
    v.volume = volume;
    try {
      await v.play();
      setBlocked(false);
    } catch {
      // التشغيل التلقائي بالصوت ممنوع قبل أي تفاعل: نبدأ صامتين ونعرض زر تفعيل الصوت.
      v.muted = true;
      setBlocked(!muted);
      void v.play().catch(() => {});
    }
  }, [muted, volume]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = blocked || muted;
    v.volume = volume;
  }, [volume, muted, blocked]);

  // مزامنة دورية، وإعادة التشغيل فورًا إن حاول أحد إيقافه (مفتاح وسائط، سماعة، إلخ).
  useEffect(() => {
    const t = setInterval(sync, 3000);
    return () => clearInterval(t);
  }, [sync]);

  if (failed) {
    return (
      <div className="live-frame">
        <DrivePlayer driveId={driveId} title={title} hue={160} autoplay startAt={startAt} />
        <div className="live-shield" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="live-player" ref={box} onContextMenu={(e) => e.preventDefault()}>
      <video
        ref={ref}
        src={`/api/live-video?id=${encodeURIComponent(driveId)}`}
        title={`البث المباشر — ${title}`}
        playsInline
        autoPlay
        muted
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          v.currentTime = Math.min(expected.current, Math.max(0, v.duration - 0.5));
          void start();
        }}
        onPause={(e) => {
          const v = e.currentTarget;
          if (!v.ended && document.visibilityState === "visible") void v.play().catch(() => {});
        }}
        onError={() => setFailed(true)}
      />
      {blocked && (
        <button type="button" className="live-unmute" onClick={() => { setBlocked(false); onVolume(volume || 1, false); }}>
          🔊 اضغط لتشغيل الصوت
        </button>
      )}
      <div className="live-bar">
        <button
          type="button"
          className="live-ibtn"
          aria-label={muted || blocked ? "تشغيل الصوت" : "كتم الصوت"}
          onClick={() => { setBlocked(false); onVolume(volume || 1, !(muted || blocked)); }}
        >
          {muted || blocked || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
        </button>
        <input
          type="range"
          className="live-vol"
          min={0}
          max={1}
          step={0.05}
          value={muted || blocked ? 0 : volume}
          aria-label="مستوى الصوت"
          onChange={(e) => { const x = Number(e.target.value); setBlocked(false); onVolume(x, x === 0); }}
        />
        <span className="live-pill" aria-hidden="true">● مباشر</span>
        <button
          type="button"
          className="live-ibtn"
          aria-label="ملء الشاشة"
          onClick={() => { const el = box.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.(); }}
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
