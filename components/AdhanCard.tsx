"use client";
import { useEffect, useRef, useState } from "react";
import MosqueArt from "@/components/MosqueArt";
import type { AdhanSettings } from "@/lib/adhanCore";

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Props = {
  cfg: AdhanSettings;
  prayerLabel: string;
  /** ثوانٍ متبقية في العدّ التنازلي. */
  remainingSec: number;
  /** محاولة تشغيل التكبيرات تلقائيًا (المتصفح قد يمنعها قبل أي تفاعل مع الموقع). */
  playAudio: boolean;
  onClose: () => void;
};

/** بطاقة نافذة الأذان: الصورة، ثم النص، ثم العدّاد. تُستخدم في الموقع وفي تجربة لوحة التحكم. */
export default function AdhanCard({ cfg, prayerLabel, remainingSec, playAudio, onClose }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = audio.current;
    if (!a || !cfg.audioUrl) return;
    a.volume = cfg.volume / 100;
    if (!playAudio) return;
    a.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    return () => a.pause();
  }, [cfg.audioUrl, cfg.volume, playAudio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && cfg.closable) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfg.closable, onClose]);

  function tapPlay() {
    const a = audio.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().then(() => setNeedsTap(false)).catch(() => {});
  }

  const text = cfg.text.replaceAll("{prayer}", prayerLabel);
  return (
    <div className="adhan-card" role="alertdialog" aria-modal="true" aria-labelledby="adhan-text">
      {cfg.closable && (
        <button type="button" className="adhan-close" onClick={onClose} aria-label="إغلاق">✕</button>
      )}
      {cfg.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="adhan-art" src={cfg.imageUrl} alt="مسجد" />
      ) : (
        <MosqueArt className="adhan-art" />
      )}
      <p id="adhan-text" className="adhan-text">{text}</p>
      <div className="adhan-timer" role="timer" aria-live="off" aria-label="الوقت المتبقي">{fmtClock(remainingSec)}</div>
      {cfg.audioUrl && (
        <>
          <audio ref={audio} src={cfg.audioUrl} preload="auto" onPlay={() => setPlaying(true)} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
          {(needsTap || !playing) && (
            <button type="button" className="adhan-sound" onClick={tapPlay}>🔊 {needsTap ? "اضغط لتشغيل التكبيرات" : "إعادة تشغيل التكبيرات"}</button>
          )}
        </>
      )}
    </div>
  );
}
