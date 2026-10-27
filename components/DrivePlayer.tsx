"use client";
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
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
    <div className="player player--frame dp-frame" style={{ "--dz": dz } as CSSProperties}>
      <iframe
        key={driveId}
        src={`https://drive.google.com/file/d/${driveId}/preview${qs ? `?${qs}` : ""}`}
        title={`مشغّل الفيديو — ${title}`}
        allow="autoplay; fullscreen"
        allowFullScreen
        // بلا allow-popups: يمنع زر «فتح في نافذة جديدة» وروابط درايف الخارجية.
        sandbox="allow-scripts allow-same-origin allow-presentation"
        loading={autoplay ? "eager" : "lazy"}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
      />
      <PlayLoader show={!loaded} />
    </div>
  );
}
