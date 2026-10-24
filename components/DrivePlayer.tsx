import type { CSSProperties } from "react";
import Icon from "@/components/Icon";

// معرّفات درايف تتكوّن من حروف وأرقام و _ و - فقط؛ نرفض غير ذلك لأمان الرابط.
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

type Props = { driveId?: string; title: string; hue: number; autoplay?: boolean; /** ثوانٍ: بدء التشغيل من هذه اللحظة (للبث المباشر). */ startAt?: number };

export default function DrivePlayer({ driveId, title, hue, autoplay = false, startAt = 0 }: Props) {
  if (driveId && DRIVE_ID.test(driveId)) {
    const q = new URLSearchParams();
    if (autoplay) q.set("autoplay", "1");
    if (startAt >= 1) q.set("t", String(Math.floor(startAt)));
    const qs = q.toString();
    return (
      <div className="player player--frame">
        <iframe
          src={`https://drive.google.com/file/d/${driveId}/preview${qs ? `?${qs}` : ""}`}
          title={`مشغّل الفيديو — ${title}`}
          allow="autoplay; fullscreen"
          allowFullScreen
          loading={autoplay ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className="player"
      role="img"
      aria-label={`الفيديو غير متوفر بعد — ${title}`}
      style={{ "--h": hue } as CSSProperties}
    >
      <span className="play"><Icon name="play" size={34} /></span>
      <span className="soon">الفيديو غير متوفر بعد</span>
    </div>
  );
}
