"use client";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Icon from "@/components/Icon";
import DriveVideoPlayer from "@/components/DriveVideoPlayer";
import YouTubePlayer from "@/components/YouTubePlayer";
import { useMiniPlayer } from "@/lib/miniPlayer";

/** مسافة السحب لأسفل (بكسل) التي تُصغّر المشغّل عند تجاوزها. */
const DRAG_COMMIT = 70;

/**
 * المشغّل المشترك على الجوال: عنصر واحد يبقى في مكانه من الشجرة، فلا يُعاد تحميل الفيديو عند التصغير أو الإرجاع.
 *  • أعلى صفحة الفيديو (full): يُوضع فوق «الفراغ» الذي تتركه الصفحة، وتحته مقبض يُسحب لأسفل فيُصغَّر.
 *  • عند الانتقال لأي صفحة أخرى (mini): شريط مصغّر أسفل الشاشة يواصل التشغيل؛ الضغط عليه يعيد صفحة الفيديو.
 * (إطار درايف/يوتيوب من نطاق آخر فلا يمرّر اللمس للصفحة، لذلك السحب يُلتقط من طبقة شفافة أعلى الفيديو ومن المقبض أسفله.)
 */
export default function MiniPlayerHost() {
  const { track, mode, slotEl, close, minimize, restore } = useMiniPlayer();
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; t0: number } | null>(null);

  // موضع المشغّل الأفقي وعرضه = موضع الفراغ في الصفحة (يتغيّر مع تدوير الشاشة أو طيّ القائمة).
  useEffect(() => {
    if (!slotEl) return;
    const measure = () => {
      const r = slotEl.getBoundingClientRect();
      setBox((b) => (b && b.x === r.left && b.w === r.width ? b : { x: r.left, w: r.width }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slotEl);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [slotEl]);

  // عند تغيّر الوضع نُزيل أي إزاحة سحب بقيت على العنصر.
  useEffect(() => {
    const el = hostRef.current;
    if (el) {
      el.style.transform = "";
      el.style.opacity = "";
      el.classList.remove("mp--drag");
    }
    drag.current = null;
  }, [mode]);

  if (!track || mode === "none") return null;
  const full = mode === "full";

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { y0: e.clientY, t0: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    hostRef.current?.classList.add("mp--drag");
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = hostRef.current;
    if (!drag.current || !el) return;
    const dy = Math.max(0, Math.min(280, e.clientY - drag.current.y0));
    el.style.transform = `translateY(${dy}px)`;
    el.style.opacity = String(1 - dy / 380);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const el = hostRef.current;
    if (!drag.current || !el) return;
    const dy = e.clientY - drag.current.y0;
    // سحبة سريعة قصيرة (فلك) تكفي كالسحبة الطويلة.
    const flick = dy > 30 && dy / Math.max(1, performance.now() - drag.current.t0) > 0.5;
    drag.current = null;
    el.classList.remove("mp--drag");
    if (dy > DRAG_COMMIT || flick) {
      el.style.transform = "translateY(90px)";
      el.style.opacity = "0";
      minimize();
    } else {
      el.style.transform = "";
      el.style.opacity = "";
    }
  };
  const onCancel = () => {
    const el = hostRef.current;
    drag.current = null;
    if (el) {
      el.classList.remove("mp--drag");
      el.style.transform = "";
      el.style.opacity = "";
    }
  };

  const style = full && box ? ({ "--mp-x": `${box.x}px`, "--mp-w": `${box.w}px` } as CSSProperties) : undefined;

  return (
    <div ref={hostRef} className={`mp mp--${mode}`} style={style} role="region" aria-label="مشغّل الفيديو">
      <div className="mp-frame">
        {track.youtubeId ? (
          <YouTubePlayer youtubeId={track.youtubeId} title={track.title} autoplay={track.autoplay} />
        ) : (
          <DriveVideoPlayer driveId={track.driveId} title={track.title} hue={160} autoplay={track.autoplay} />
        )}
        {full && (
          // طبقة شفافة فوق أعلى الفيديو تلتقط السحب لأسفل (إطار درايف لا يمرّر اللمس للصفحة)؛ باقي الفيديو وأزرار التشغيل أسفله تبقى تعمل.
          <div
            className="mp-swipe"
            role="presentation"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
          />
        )}
      </div>
      {full ? (
        <div className="mp-handle">
          <button type="button" className="mp-min" aria-label="تصغير الفيديو ومتابعة تصفح الموقع" title="تصغير" onClick={minimize}>
            <Icon name="chevdown" size={22} />
          </button>
          <div
            className="mp-grab"
            role="presentation"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
          />
          <span className="mp-spacer" aria-hidden="true" />
        </div>
      ) : (
        <>
          <div className="mp-info">
            <strong>{track.title}</strong>
            {track.seriesName && <small>{track.seriesName}</small>}
          </div>
          <button type="button" className="mp-hit" aria-label={`العودة إلى الفيديو: ${track.title}`} onClick={restore} />
          <button type="button" className="mp-close" aria-label="إغلاق المشغّل المصغّر" title="إغلاق" onClick={close}>
            <Icon name="close" size={20} />
          </button>
        </>
      )}
    </div>
  );
}
