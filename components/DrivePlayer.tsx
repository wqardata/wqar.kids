"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  /** ثوانٍ: نهاية المقدمة/الإعلان معًا (للتوافق القديم). غير محدّدة = الافتراضي من الإعدادات، و0 = بلا زر. */
  skipTo?: number;
  /** ثوانٍ: مدة الإعلان في بداية الفيديو (زر «تخطي الإعلان»). */
  adSec?: number;
  /** ثوانٍ: مدة المقدمة بعد الإعلان (زر «تخطي المقدمة»). */
  introSec?: number;
};

type Stage = { label: string; end: number };

export default function DrivePlayer({ driveId, title, hue, autoplay = false, startAt = 0, skipTo: skipProp, adSec, introSec }: Props) {
  const { settings } = useSettings();
  const [loaded, setLoaded] = useState(false);
  const [seek, setSeek] = useState(0); // بعد الضغط على «تخطي»: الثانية التي يبدأ منها المشغّل
  const [, setTick] = useState(0);
  const loadedAt = useRef(0);

  // مراحل زر التخطي: الإعلان (إن وُجد) ثم المقدمة. مدة كل مرحلة تأتي من الكشف التلقائي أو من تعديل المشرف.
  // إن لم تُحدَّد مدة الإعلان ولا المقدمة نعود للمدة الافتراضية من الإعدادات كزر «تخطي» واحد.
  const stages = useMemo<Stage[]>(() => {
    const out: Stage[] = [];
    if (adSec === undefined && introSec === undefined) {
      const t = skipProp ?? settings.skipDefaultSec;
      if (t > 0) out.push({ label: "تخطي", end: t });
      return out;
    }
    const ad = adSec && adSec > 0 ? adSec : 0;
    const intro = introSec && introSec > 0 ? introSec : 0;
    if (ad) out.push({ label: "تخطي الإعلان", end: ad });
    if (intro) out.push({ label: "تخطي المقدمة", end: ad + intro });
    return out;
  }, [adSec, introSec, skipProp, settings.skipDefaultSec]);

  // نقدّر موضع التشغيل من لحظة تحميل المشغّل (لا نستطيع قراءة وقت التشغيل من داخل مشغّل درايف).
  const markLoaded = () => {
    loadedAt.current = Date.now();
    setLoaded(true);
  };

  // احتياط: إن لم يصل حدث التحميل (حظر أو بطء) نُخفي الشاشة بعد مدة كي لا تحجب المشغّل.
  useEffect(() => {
    setLoaded(false);
    setSeek(0);
    const t = setTimeout(() => {
      loadedAt.current = Date.now();
      setLoaded(true);
    }, 15_000);
    return () => clearTimeout(t);
  }, [driveId]);

  const position = loaded ? seek + (Date.now() - loadedAt.current) / 1000 : seek;
  const stage = loaded ? stages.find((st) => st.end > seek && st.end > position) : undefined;

  // نعيد الرسم كل نصف ثانية ما دام هناك زر قادم أو ظاهر.
  const pending = stages.some((st) => st.end > seek);
  useEffect(() => {
    if (!loaded || !pending) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [loaded, pending, seek]);

  if (driveId && DRIVE_ID.test(driveId)) {
    const from = seek || startAt;
    const q = new URLSearchParams();
    if (autoplay || seek) q.set("autoplay", "1");
    if (from >= 1) q.set("t", String(Math.floor(from)));
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
          onLoad={markLoaded}
        />
        <PlayLoader show={!loaded} />
        {stage && (
          <button
            type="button"
            className="skip-btn"
            onClick={() => {
              setLoaded(false);
              setSeek(stage.end);
            }}
          >
            {stage.label} <Icon name="play" size={16} />
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
