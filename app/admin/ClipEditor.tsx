"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as RPointerEvent, type SyntheticEvent } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { getDb } from "@/lib/firebase";
import { formatClock } from "@/lib/format";
import { deleteThumb, saveThumb } from "@/lib/thumbs";
import type { useNamedList, VideoDoc } from "@/lib/videos";

type NamedList = ReturnType<typeof useNamedList>;

const MAX_LEN = 180; // أطول مقطع شورتس بالثواني
const MIN_LEN = 1;
const PREVIEW_W = 180;
const PREVIEW_H = 320;

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** مستطيل القص من الفيديو المصدر لإطار 9:16 عند الموضع الأفقي x (0–1). */
function cropRect(vw: number, vh: number, x: number) {
  if (vw / vh > 9 / 16) {
    const sw = (vh * 9) / 16;
    return { sx: (vw - sw) * x, sy: 0, sw, sh: vh };
  }
  const sh = (vw * 16) / 9;
  return { sx: 0, sy: (vh - sh) / 2, sw: vw, sh };
}

function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => { clearTimeout(timer); v.removeEventListener("seeked", done); resolve(); };
    const timer = setTimeout(() => { v.removeEventListener("seeked", done); reject(new Error("seek timeout")); }, 20_000);
    v.addEventListener("seeked", done);
    v.currentTime = t;
  });
}

/** اقتصاص مقطع طولي (9:16) من فيديو الموقع: اختر البداية والنهاية وموضع الإطار، ثم انشره في «قصيرة». */
export default function ClipEditor({ video, categories, onCancel, onCreated }: {
  video: VideoDoc;
  categories: NamedList;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const ref = useRef<HTMLVideoElement>(null);
  const srcBox = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef(false);
  const [src, setSrc] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dims, setDims] = useState({ w: 16, h: 9 });
  const [duration, setDuration] = useState(0);
  const [pos, setPos] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(30);
  const [x, setX] = useState(0.5);
  const [previewing, setPreviewing] = useState(false);
  const [title, setTitle] = useState(`${video.title} — مقطع`.slice(0, 150));
  const [categoryId, setCategoryId] = useState(video.categoryId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // رابط المصدر عبر وسيط المشرف (من نفس النطاق كي يُسمح برسم الإطار على canvas).
  useEffect(() => {
    let off = false;
    if (!user) return;
    user.getIdToken().then((t) => {
      if (!off) setSrc(`/api/drive-video?id=${encodeURIComponent(video.driveId)}&token=${encodeURIComponent(t)}`);
    }).catch(() => !off && setState("error"));
    return () => { off = true; };
  }, [user, video.driveId]);

  const f = Math.min(1, 9 / 16 / (dims.w / dims.h)); // عرض الإطار الطولي كنسبة من عرض الفيديو

  const draw = useCallback(() => {
    const v = ref.current, c = canvas.current;
    if (!v || !c || !v.videoWidth) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { sx, sy, sw, sh } = cropRect(v.videoWidth, v.videoHeight, x);
    try { ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height); } catch { /* الإطار غير جاهز بعد */ }
  }, [x]);

  // المعاينة الطولية تُرسم باستمرار أثناء التشغيل، وعند كل تغيير في الموضع أو التمرير.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = ref.current;
      if (v) {
        setPos(v.currentTime);
        if (previewing && v.currentTime >= end) void seekTo(v, start).then(() => v.play().catch(() => {})).catch(() => {});
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    if (previewing) raf = requestAnimationFrame(tick);
    else draw();
    return () => cancelAnimationFrame(raf);
  }, [previewing, start, end, draw]);

  function onMeta(e: SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    if (!Number.isFinite(v.duration) || v.duration <= 0 || !v.videoWidth) return setState("error");
    setDims({ w: v.videoWidth, h: v.videoHeight });
    setDuration(v.duration);
    setEnd(r1(Math.min(v.duration, 30)));
    setState("ready");
  }

  const stopPreview = () => { setPreviewing(false); ref.current?.pause(); };

  async function togglePreview() {
    const v = ref.current;
    if (!v) return;
    if (previewing) return stopPreview();
    await seekTo(v, start).catch(() => {});
    setPreviewing(true);
    void v.play().catch(() => setPreviewing(false));
  }

  function scrub(t: number) {
    const v = ref.current;
    if (!v) return;
    stopPreview();
    v.currentTime = clamp(t, 0, duration);
    setPos(v.currentTime);
  }

  const setStartSafe = (t: number) => {
    const s = clamp(r1(t), 0, Math.max(0, duration - MIN_LEN));
    setStart(s);
    setEnd((e) => clamp(e, s + MIN_LEN, Math.min(duration, s + MAX_LEN)));
  };
  const setEndSafe = (t: number) => setEnd(clamp(r1(t), start + MIN_LEN, Math.min(duration, start + MAX_LEN)));

  // سحب الإطار الطولي فوق الفيديو لاختيار الجزء الظاهر.
  function moveWindow(e: RPointerEvent) {
    const box = srcBox.current;
    if (!box || f >= 1) return;
    const r = box.getBoundingClientRect();
    const center = (e.clientX - r.left) / r.width;
    setX(clamp((center - f / 2) / (1 - f), 0, 1));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = ref.current;
    if (!user || !v || state !== "ready") return;
    if (!title.trim()) return setError("اكتب عنوان المقطع.");
    if (end - start < MIN_LEN) return setError("المقطع قصير جدًا.");
    if (end - start > MAX_LEN + 0.05) return setError(`أطول مقطع مسموح ${MAX_LEN} ثانية.`);
    stopPreview();
    setSaving(true);
    setError("");
    const ref2 = doc(collection(getDb(), "videos"));
    let savedThumb = false;
    try {
      // صورة مصغّرة طولية من لقطة داخل المقطع.
      await seekTo(v, start + Math.min(1.5, (end - start) / 3));
      const c = document.createElement("canvas");
      c.width = 360;
      c.height = 640;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("canvas");
      const { sx, sy, sw, sh } = cropRect(v.videoWidth, v.videoHeight, x);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
      let data = "";
      for (const q of [0.8, 0.65, 0.5]) {
        data = c.toDataURL("image/jpeg", q);
        if (data.length <= 200_000) break;
      }
      let thumbnail: string;
      try {
        thumbnail = await saveThumb(ref2.id, data);
        savedThumb = true;
      } catch {
        setError("تعذّر حفظ الصورة المصغّرة. حدّث قواعد Firestore (thumbs) من firestore.rules.");
        setSaving(false);
        return;
      }
      const cat = categories.items.find((c2) => c2.id === categoryId);
      try {
        await setDoc(ref2, {
          title: title.trim(),
          driveId: video.driveId,
          thumbnail,
          duration: Math.round(end - start),
          description: video.description,
          categoryId: cat?.id ?? "",
          categoryName: cat?.name ?? "",
          seriesId: "",
          seriesName: "",
          season: null,
          episode: null,
          isShort: true,
          hidden: false,
          clipStart: r1(start),
          clipEnd: r1(end),
          clipX: Math.round(x * 1000) / 1000,
          clipSourceId: video.id,
          createdBy: user.uid,
          createdByEmail: user.email ?? "",
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        if (savedThumb) void deleteThumb(ref2.id);
        throw err;
      }
      onCreated();
    } catch {
      setError("تعذّر نشر المقطع. تأكد من صلاحياتك وقواعد Firestore، وأن الفيديو يعمل في المتصفح.");
      setSaving(false);
    }
  }

  const len = Math.max(0, end - start);
  return (
    <form className="auth-form clip-ed" onSubmit={(e) => void submit(e)}>
      <h3>اقتصاص مقطع طولي من «{video.title}»</h3>
      <p className="hint">اختر الجزء الذي تريده من الفيديو، وحرّك الإطار الطولي ليحدّد ما يظهر في الشورتس. لا يُعاد رفع الملف: المقطع يستعمل نفس فيديو درايف.</p>
      {state === "loading" && <p className="hint" role="status">جارٍ تحميل الفيديو…</p>}
      {state === "error" && <p className="field-error" role="alert">تعذّر فتح الفيديو في المتصفح (صيغة غير مدعومة أو الملف غير مشارك للعموم).</p>}
      <div className="clip-stage" style={state === "error" ? { display: "none" } : undefined}>
        <div>
          <div
            className="clip-src"
            ref={srcBox}
            onPointerDown={(e) => { drag.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); moveWindow(e); }}
            onPointerMove={(e) => drag.current && moveWindow(e)}
            onPointerUp={() => { drag.current = false; }}
            onPointerCancel={() => { drag.current = false; }}
          >
            {src && (
              <video
                ref={ref}
                src={src}
                playsInline
                muted={false}
                preload="auto"
                onLoadedMetadata={onMeta}
                onError={() => setState("error")}
                onSeeked={draw}
                onLoadedData={draw}
                onPause={() => setPreviewing(false)}
              />
            )}
            {state === "ready" && f < 1 && (
              <div className="clip-win" style={{ width: `${f * 100}%`, left: `${x * (1 - f) * 100}%` }} aria-hidden="true" />
            )}
          </div>
          {state === "ready" && (
            <div className="field">
              <label htmlFor="clip-pos">الموضع الحالي: {formatClock(pos)} / {formatClock(duration)}</label>
              <input id="clip-pos" className="clip-range" dir="ltr" type="range" min={0} max={duration} step={0.1} value={pos} onChange={(e) => scrub(Number(e.target.value))} />
            </div>
          )}
        </div>
        <div>
          <canvas ref={canvas} className="clip-prev" width={PREVIEW_W * 2} height={PREVIEW_H * 2} aria-label="معاينة الإطار الطولي" />
          {state === "ready" && f < 1 && (
            <div className="field">
              <label htmlFor="clip-x">موضع الإطار</label>
              <input id="clip-x" className="clip-range" dir="ltr" type="range" min={0} max={1} step={0.01} value={x} onChange={(e) => setX(Number(e.target.value))} />
            </div>
          )}
        </div>
      </div>
      {state === "ready" && (
        <>
          <div className="clip-times">
            <div className="field">
              <label htmlFor="clip-s">البداية (ثانية)</label>
              <input id="clip-s" type="number" min={0} max={duration} step={0.1} value={start} onChange={(e) => setStartSafe(Number(e.target.value) || 0)} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStartSafe(pos)}>تعيين من الموضع الحالي</button>
            </div>
            <div className="field">
              <label htmlFor="clip-e">النهاية (ثانية)</label>
              <input id="clip-e" type="number" min={0} max={duration} step={0.1} value={end} onChange={(e) => setEndSafe(Number(e.target.value) || 0)} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEndSafe(pos)}>تعيين من الموضع الحالي</button>
            </div>
          </div>
          <p className="clip-len">طول المقطع: {formatClock(len)} (الحد الأقصى {formatClock(MAX_LEN)})</p>
          <div className="addrow">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void togglePreview()}>
              <Icon name={previewing ? "close" : "play"} size={14} /> {previewing ? "إيقاف المعاينة" : "معاينة المقطع"}
            </button>
          </div>
          <div className="field">
            <label htmlFor="clip-t">عنوان المقطع</label>
            <input id="clip-t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
          </div>
          <CreatableSelect label="التصنيف" items={categories.items} value={categoryId} onChange={setCategoryId} onCreate={categories.create}
            placeholder="بدون تصنيف" newLabel="إضافة تصنيف جديد…" newPlaceholder="اسم التصنيف الجديد" disabled={categories.loading} />
        </>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="addrow">
        <button type="submit" disabled={saving || state !== "ready"}>{saving ? "جارٍ النشر…" : "نشر في «قصيرة»"}</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>إلغاء</button>
      </div>
    </form>
  );
}
