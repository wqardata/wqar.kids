"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import "@/app/player.css";
import Icon from "@/components/Icon";
import PlayLoader from "@/components/PlayLoader";
import { DRIVE_ID } from "@/lib/drive";
import { useSettings } from "@/lib/settings";

/** محفوظ للتوافق مع الاستدعاءات القديمة (لم يعد للجودات الإضافية أثر: المشغّل هو مشغّل درايف الأصلي). */
export type Quality = { label: string; driveId: string };

type Props = {
  driveId?: string;
  title: string;
  hue: number;
  autoplay?: boolean;
  /** ثوانٍ: بدء التشغيل من هذه اللحظة. */
  startAt?: number;
  qualities?: Quality[];
};

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** مشغّل درايف الأصلي (iframe). أُزيل المشغّل المخصّص. */
export default function DrivePlayer({ driveId, title, hue, autoplay = false, startAt = 0 }: Props) {
  const ok = !!driveId && DRIVE_ID.test(driveId);
  const [loaded, setLoaded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // ملء الشاشة: إطار درايف نفسه لا يمكن تصغير أزراره حين يملأ الشاشة، لذا حيث يدعم المتصفح ملء شاشة العناصر
  // نمنع زر درايف الأصلي ونعرض زرّنا الذي يملأ الشاشة بغلاف الإطار، فيسري عليه نفس «حجم الأزرار».
  const [canFs, setCanFs] = useState(false);
  const [fs, setFs] = useState(false);
  useEffect(() => {
    setCanFs(!!document.fullscreenEnabled);
    const on = () => setFs(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFs = () => {
    const el = box.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };
  const { settings } = useSettings();
  // حجم واجهة درايف على الجوال من لوحة التحكم (يقرأه globals.css عبر --dz).
  const dz = settings.watchPage.driveBtnScale / 100;

  // يخبر التنسيق (globals.css) بنوع المشغّل كي يضبط ارتفاع «الفراغ» في المشغّل المشترك على الجوال.
  useIsoLayoutEffect(() => {
    document.documentElement.dataset.dpm = "frame";
    return () => { delete document.documentElement.dataset.dpm; };
  }, []);

  // احتياط إن لم يصل حدث التحميل.
  useEffect(() => {
    setLoaded(false);
    const t = setTimeout(() => setLoaded(true), 15_000);
    return () => clearTimeout(t);
  }, [driveId]);

  if (!ok) {
    return (
      <div className="player" role="img" aria-label={`الفيديو غير متوفر بعد — ${title}`} style={{ "--h": hue } as CSSProperties}>
        <span className="play"><Icon name="play" size={34} /></span>
        <span className="soon">الفيديو غير متوفر بعد</span>
      </div>
    );
  }

  const q = new URLSearchParams();
  if (autoplay) q.set("autoplay", "1");
  if (startAt >= 1) q.set("t", String(Math.floor(startAt)));
  const qs = q.toString();
  return (
    <div ref={box} className={`player player--frame dp-frame${fs ? " dp-frame--fs" : ""}`} style={{ "--dz": dz } as CSSProperties}>
      <iframe
        key={driveId}
        src={`https://drive.google.com/file/d/${driveId}/preview${qs ? `?${qs}` : ""}`}
        title={`مشغّل الفيديو — ${title}`}
        allow="autoplay; fullscreen"
        allowFullScreen={!canFs}
        // بلا allow-popups: يمنع زر «فتح في نافذة جديدة» وروابط درايف الخارجية.
        sandbox="allow-scripts allow-same-origin allow-presentation"
        loading={autoplay ? "eager" : "lazy"}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
      />
      {canFs && (
        <button type="button" className="dp-fsbtn" onClick={toggleFs} aria-label={fs ? "الخروج من ملء الشاشة" : "ملء الشاشة"}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {fs ? <path d="M8 3h2v5H5V6h3V3zm6 0h2v3h3v2h-5V3zM5 16h5v5H8v-3H5v-2zm9 0h5v2h-3v3h-2v-5z" /> : <path d="M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zM5 14h2v3h3v2H5v-5zm12 0h2v5h-5v-2h3v-3z" />}
          </svg>
        </button>
      )}
      <PlayLoader show={!loaded} />
    </div>
  );
}
