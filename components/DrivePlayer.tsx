import type { CSSProperties } from "react";
import Icon from "@/components/Icon";

// معرّفات درايف تتكوّن من حروف وأرقام و _ و - فقط؛ نرفض غير ذلك لأمان الرابط.
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

type Props = { driveId?: string; title: string; hue: number; autoplay?: boolean };

export default function DrivePlayer({ driveId, title, hue, autoplay = false }: Props) {
  if (driveId && DRIVE_ID.test(driveId)) {
    return (
      <div className="player player--frame">
        <iframe
          src={`https://drive.google.com/file/d/${driveId}/preview${autoplay ? "?autoplay=1" : ""}`}
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
