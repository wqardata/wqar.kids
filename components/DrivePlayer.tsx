"use client";
import { useEffect, useState, type CSSProperties } from "react";
import Icon from "@/components/Icon";
import PlayLoader from "@/components/PlayLoader";
import { useSettings } from "@/lib/settings";

// معرّفات درايف تتكوّن من حروف وأرقام و _ و - فقط؛ نرفض غير ذلك لأمان الرابط.
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

type Props = {
  driveId?: string;
  title: string;
  hue: number;
  autoplay?: boolean;
  /** ثوانٍ: بدء التشغيل من هذه اللحظة (للبث المباشر). */
  startAt?: number;
  /** ثوانٍ: نهاية المقدمة/الإعلان. غير محدّدة = الافتراضي من الإعدادات، و0 = بلا زر. */
  skipTo?: number;
};

export default function DrivePlayer({ driveId, title, hue, autoplay = false, startAt = 0, skipTo: skipProp }: Props) {
  const { settings } = useSettings();
  const skipTo = skipProp ?? settings.skipDefaultSec;
  const [loaded, setLoaded] = useState(false);
  const [seek, setSeek] = useState(0); // بعد الضغط على «تخطي»: الثانية التي يبدأ منها المشغّل
  const [expired, setExpired] = useState(false); // انتهت مدة المقدمة فيُخفى الزر
  // احتياط: إن لم يصل حدث التحميل (حظر أو بطء) نُخفي الشاشة بعد مدة كي لا تحجب المشغّل.
  useEffect(() => {
    setLoaded(false);
    setSeek(0);
    setExpired(false);
    const t = setTimeout(() => setLoaded(true), 15_000);
    return () => clearTimeout(t);
  }, [driveId]);

  // يظهر الزر من لحظة تحميل المشغّل حتى تمضي مدة المقدمة (لا نستطيع قراءة وقت التشغيل من داخل مشغّل درايف).
  useEffect(() => {
    if (!loaded || !skipTo || seek || expired) return;
    const t = setTimeout(() => setExpired(true), skipTo * 1000);
    return () => clearTimeout(t);
  }, [loaded, skipTo, seek, expired]);

  if (driveId && DRIVE_ID.test(driveId)) {
    const from = seek || startAt;
    const q = new URLSearchParams();
    if (autoplay || seek) q.set("autoplay", "1");
    if (from >= 1) q.set("t", String(Math.floor(from)));
    const qs = q.toString();
    const showSkip = skipTo > 0 && !seek && !expired;
    return (
      <div className="player player--frame">
        <iframe
          src={`https://drive.google.com/file/d/${driveId}/preview${qs ? `?${qs}` : ""}`}
          title={`مشغّل الفيديو — ${title}`}
          allow="autoplay; fullscreen"
          allowFullScreen
          loading={autoplay ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
        />
        <PlayLoader show={!loaded} />
        {showSkip && (
          <button
            type="button"
            className="skip-btn"
            onClick={() => {
              setLoaded(false);
              setSeek(skipTo);
            }}
          >
            تخطي <Icon name="play" size={16} />
          </button>
        )}
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
