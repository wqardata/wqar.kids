"use client";
import { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { PREVIEW_FRAME_NAME } from "@/lib/previewFrame";
import { PREVIEW_FOCUS_MSG, PREVIEW_MSG, PREVIEW_READY, usePreviewDraftValue } from "@/lib/preview";
import { USE_NEON } from "@/lib/backend";
import { neonLatest } from "@/lib/neonClient";
import { toVideo, type VideoDoc } from "@/lib/videos";

const DEVICES = [
  { id: "desktop", label: "الكمبيوتر", w: 1280 },
  { id: "tablet", label: "التابلت", w: 820 },
  { id: "mobile", label: "الموبايل", w: 390 },
] as const;
type DeviceId = (typeof DEVICES)[number]["id"];

/** شاشات الأذان والأذكار صُمّمت للجوال أولًا، فتُعرض افتراضيًا بعرضه (والمشرف يغيّره متى شاء). */
const defaultDevice = (p: string): DeviceId => (p.startsWith("/preview/") ? "mobile" : "desktop");

/** معرّف فيديو ظاهر لعرضه في معاينة صفحة الفيديو. */
function useSampleVideo(enabled: boolean): string {
  const [id, setId] = useState("");
  useEffect(() => {
    if (!enabled || id || !isFirebaseConfigured) return;
    let off = false;
    const latest: Promise<VideoDoc[]> = USE_NEON
      ? neonLatest(12)
      : getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(12))).then((snap) => snap.docs.map((d) => toVideo(d.id, d.data())));
    latest
      .then((list) => {
        const v = list.find((x) => !x.hidden && !x.isShort);
        if (!off && v) setId(v.id);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [enabled, id]);
  return id;
}

/**
 * معاينة حيّة للموقع بعرض الكمبيوتر أو التابلت أو الموبايل. تعرض الصفحة الحقيقية داخل iframe بعرض الجهاز ثم تصغّرها لتناسب العمود،
 * وتطبّق عليها مسودة التبويب غير المحفوظة. `path`: الصفحة المعروضة؛ "@video" = أي فيديو من المكتبة.
 */
export default function SitePreview({ path, focus = "" }: { path: string; focus?: string }) {
  const draft = usePreviewDraftValue();
  const [device, setDevice] = useState<DeviceId>(() => defaultDevice(path));
  useEffect(() => setDevice(defaultDevice(path)), [path]);
  const [nonce, setNonce] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const videoId = useSampleVideo(path === "@video");
  const src = path === "@video" ? (videoId ? `/v/${videoId}` : "") : path;

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const send = (d: typeof draft) => frame.current?.contentWindow?.postMessage({ type: PREVIEW_MSG, settings: d }, window.location.origin);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const sendFocus = () => frame.current?.contentWindow?.postMessage({ type: PREVIEW_FOCUS_MSG, selector: focusRef.current }, window.location.origin);

  // الإطار يخبرنا أنه جاهز (بعد كل تنقّل) فنرسل له المسودة الحالية.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type === PREVIEW_READY) {
        send(draftRef.current);
        sendFocus();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // وكل تعديل على المسودة يُرسل فورًا.
  useEffect(() => {
    send(draft);
  }, [draft]);

  // تغيّر القسم المركَّز عليه: ننزل إلى عنصره في الصفحة المعروضة.
  useEffect(() => {
    sendFocus();
  }, [focus]);

  const dev = DEVICES.find((d) => d.id === device)!;
  const scale = box.w > 0 ? Math.min(1, box.w / dev.w) : 1;
  const innerH = box.h > 0 ? box.h / scale : 800;

  return (
    <div className="pv">
      <div className="pv-bar">
        <div className="range-seg" role="group" aria-label="نوع الجهاز">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" className={d.id === device ? "on" : undefined} aria-pressed={d.id === device} onClick={() => setDevice(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setNonce((n) => n + 1)} title="إعادة تحميل المعاينة">↻</button>
      </div>
      <div className="pv-stage" ref={stage} data-device={device}>
        {src ? (
          <div className="pv-device" style={{ width: dev.w * scale, height: box.h || undefined }}>
            <iframe
              key={`${src}|${nonce}`}
              ref={frame}
              name={PREVIEW_FRAME_NAME}
              src={src}
              title={`معاينة الموقع — ${dev.label}`}
              style={{ width: dev.w, height: innerH, transform: `scale(${scale})` }}
              onLoad={() => {
                send(draftRef.current);
                sendFocus();
              }}
            />
          </div>
        ) : (
          <p className="empty-note">لا يوجد فيديو للمعاينة بعد.</p>
        )}
      </div>
      <small className="hint">المعاينة تُظهر التعديلات قبل الحفظ، ولا تُحسب مشاهداتها.</small>
    </div>
  );
}
