"use client";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import "@/app/player.css";
import DrivePlayer from "@/components/DrivePlayer";
import Icon from "@/components/Icon";
import PlayLoader from "@/components/PlayLoader";
import { DRIVE_ID } from "@/lib/drive";
import { CUSTOM_VIDEO_PLAYER, driveVideoUrl } from "@/lib/driveVideo";

type Props = {
  driveId?: string;
  title: string;
  hue: number;
  autoplay?: boolean;
  /** ثوانٍ: بدء التشغيل من هذه اللحظة. */
  startAt?: number;
};

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP = 10;
/** إن بدأ التشغيل ولم تصل بيانات الفيديو خلال هذه المدة نعتبر الرابط المباشر مرفوضًا. */
const STALL_MS = 15_000;

function fmt(t: number): string {
  const s = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * مشغّل فيديو درايف الخاص (على نمط مشغّل الإذاعة): عنصر video يقرأ الملف مباشرة من درايف دون المرور بخادم الموقع،
 * بأزرارنا (تشغيل، تقديم وتأخير ١٠ ثوانٍ، الصوت، السرعة، ملء الشاشة).
 * إن رفض المتصفح الرابط المباشر (حدود درايف أو ملف غير مشارك) نعرض مشغّل درايف الأصلي لهذا الفيديو بدلًا منه.
 * يقبل نفس خصائص DrivePlayer فيصلح بديلًا عنه.
 */
export default function DriveVideoPlayer({ driveId, title, hue, autoplay = false, startAt = 0 }: Props) {
  // معرّف الفيديو الذي رفضه المتصفح (يُعاد المحاولة تلقائيًا إن تغيّر الفيديو).
  const [bad, setBad] = useState("");
  // اللحظة التي كان عندها المشاهد حين ضغط «الجودة»: يكمل مشغّل درايف من عندها.
  const [resume, setResume] = useState(0);
  if (!CUSTOM_VIDEO_PLAYER || !driveId || !DRIVE_ID.test(driveId) || bad === driveId) {
    return <DrivePlayer driveId={driveId} title={title} hue={hue} autoplay={autoplay || resume > 0} startAt={resume || startAt} />;
  }
  const id: string = driveId;
  return (
    <CustomPlayer
      key={id}
      driveId={id}
      title={title}
      hue={hue}
      autoplay={autoplay}
      startAt={startAt}
      onFail={() => setBad(id)}
      onQuality={(t) => { setResume(Math.floor(t)); setBad(id); }}
    />
  );
}

function CustomPlayer({ driveId, title, hue, autoplay, startAt, onFail, onQuality }: Required<Omit<Props, "driveId">> & { driveId: string; onFail: () => void; onQuality: (t: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false); // وصلت بيانات كافية لعرض أول لقطة
  const [waiting, setWaiting] = useState(false); // توقف مؤقت للتحميل أثناء التشغيل
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [menu, setMenu] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fs, setFs] = useState(false);
  const [canFs, setCanFs] = useState(false);
  const [flash, setFlash] = useState<{ k: number; dir: "back" | "fwd" } | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTap = useRef(0);
  const sawData = useRef(false);

  const v = () => vid.current;
  const clearStall = () => { clearTimeout(stallTimer.current); stallTimer.current = undefined; };

  const toggle = () => {
    const el = v();
    if (!el) return;
    setMenu(false);
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };
  const seekTo = (t: number) => {
    const el = v();
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : t;
    el.currentTime = Math.min(Math.max(0, t), max);
    setTime(el.currentTime);
  };
  const skip = (d: number) => {
    const el = v();
    if (!el) return;
    seekTo(el.currentTime + d);
    setFlash({ k: Date.now(), dir: d < 0 ? "back" : "fwd" });
  };
  const changeVol = (x: number) => {
    const el = v();
    const nv = Math.min(1, Math.max(0, x));
    setVol(nv);
    setMuted(nv === 0);
    if (el) { el.volume = nv; el.muted = nv === 0; }
    try { localStorage.setItem("video-vol", String(nv)); localStorage.setItem("video-muted", nv === 0 ? "1" : "0"); } catch { /* التخزين غير متاح */ }
  };
  const toggleMute = () => {
    const el = v();
    const m = !muted;
    if (m === false && vol === 0) { changeVol(0.6); return; }
    setMuted(m);
    if (el) el.muted = m;
    try { localStorage.setItem("video-muted", m ? "1" : "0"); } catch { /* التخزين غير متاح */ }
  };
  const setSpeed = (r: number) => {
    setRate(r);
    const el = v();
    if (el) el.playbackRate = r;
    setMenu(false);
  };
  const toggleFs = () => {
    const el = box.current;
    const vi = v() as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (document.fullscreenEnabled) void el.requestFullscreen?.().catch(() => {});
    else vi?.webkitEnterFullscreen?.(); // iPhone: لا يدعم ملء شاشة العناصر العادية
  };

  // إخفاء الأزرار بعد ثوانٍ من عدم الحركة أثناء التشغيل.
  const wake = () => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 2600);
  };

  // أول تركيب: الصوت المحفوظ، دعم ملء الشاشة، وتنظيف المؤقتات.
  useEffect(() => {
    setCanFs(!!document.fullscreenEnabled || "webkitEnterFullscreen" in document.createElement("video"));
    const on = () => setFs(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    try {
      const s = localStorage.getItem("video-vol");
      const el = vid.current;
      if (s !== null) {
        const n = Number(s);
        if (Number.isFinite(n)) { const x = Math.min(1, Math.max(0, n)); setVol(x); if (el) el.volume = x; }
      }
      if (localStorage.getItem("video-muted") === "1") { setMuted(true); if (el) el.muted = true; }
    } catch { /* التخزين غير متاح */ }
    return () => {
      document.removeEventListener("fullscreenchange", on);
      clearTimeout(idleTimer.current);
      clearTimeout(tapTimer.current);
      clearTimeout(stallTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(t);
  }, [flash]);

  // عند التشغيل: إن لم تصل أي بيانات خلال المدة نرجع لمشغّل درايف الأصلي.
  const armStall = () => {
    if (sawData.current || stallTimer.current) return;
    stallTimer.current = setTimeout(() => { if (!sawData.current) onFail(); }, STALL_MS);
  };

  const onSurface = (e: ReactMouseEvent<HTMLDivElement>) => {
    wake();
    const now = Date.now();
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / Math.max(1, r.width);
    if (now - lastTap.current < 280 && (x < 0.35 || x > 0.65)) {
      // نقرتان على الجانبين: تأخير أو تقديم.
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      skip(x < 0.35 ? -SKIP : SKIP);
      return;
    }
    lastTap.current = now;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(toggle, 250);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // الأزرار وأشرطة التمرير تتولى مفاتيحها
    const k = e.key;
    if (k === " " || k === "k" || k === "K") toggle();
    else if (k === "ArrowLeft") skip(-5);
    else if (k === "ArrowRight") skip(5);
    else if (k === "ArrowUp") changeVol(vol + 0.1);
    else if (k === "ArrowDown") changeVol(vol - 0.1);
    else if (k === "m" || k === "M") toggleMute();
    else if (k === "f" || k === "F") toggleFs();
    else return;
    e.preventDefault();
    wake();
  };

  // مؤشر التحميل يظهر بعد بدء التشغيل فقط؛ إن منع المتصفح التشغيل التلقائي يبقى زر التشغيل ظاهرًا ولا يعلق المؤشر.
  const loading = started && !ready;
  const showIdle = idle && playing && !menu;
  const pct = dur > 0 ? Math.min(100, (time / dur) * 100) : 0;
  const bufPct = dur > 0 ? Math.min(100, (buf / dur) * 100) : 0;
  const cls = `player dp${showIdle ? " dp--idle" : ""}${fs ? " dp--fs" : ""}`;

  return (
    <div
      ref={box}
      className={cls}
      style={{ "--h": hue } as CSSProperties}
      tabIndex={0}
      role="group"
      aria-label={`مشغّل الفيديو — ${title}`}
      onPointerMove={wake}
      onKeyDown={onKey}
    >
      <video
        ref={vid}
        className="dp-video"
        src={driveVideoUrl(driveId)}
        preload="metadata"
        playsInline
        autoPlay={autoplay}
        onPlay={() => { setPlaying(true); setStarted(true); armStall(); wake(); }}
        onPause={() => { setPlaying(false); setIdle(false); }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => { setWaiting(false); setReady(true); }}
        onCanPlay={() => { setWaiting(false); setReady(true); }}
        onLoadedMetadata={(e) => {
          sawData.current = true;
          clearStall();
          const el = e.currentTarget;
          setDur(Number.isFinite(el.duration) ? el.duration : 0);
          if (startAt >= 1 && Number.isFinite(el.duration) && startAt < el.duration) el.currentTime = startAt;
          el.playbackRate = rate;
        }}
        onLoadedData={() => { sawData.current = true; clearStall(); setReady(true); }}
        onDurationChange={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          setBuf(b.length ? b.end(b.length - 1) : 0);
        }}
        onEnded={() => { setPlaying(false); setIdle(false); }}
        // رفض المتصفح الرابط المباشر (حدود درايف أو ملف غير مشارك): مشغّل درايف الأصلي لهذا الفيديو.
        onError={onFail}
      />
      <div className="dp-surface" onClick={onSurface} />
      {flash && <span key={flash.k} className={`dp-flash dp-flash--${flash.dir}`} aria-hidden="true">{flash.dir === "back" ? `−${SKIP}` : `+${SKIP}`}</span>}
      {waiting && playing && ready && <span className="dp-spin" aria-hidden="true" />}
      {!playing && !loading && (
        <button type="button" className="dp-center" onClick={toggle} aria-label={started ? "متابعة التشغيل" : "تشغيل"}>
          <Icon name="play" size={34} />
        </button>
      )}

      <div className="dp-ui">
        {menu && (
          <div className="dp-menu" role="menu" aria-label="سرعة التشغيل">
            <button type="button" className="dp-menu-head" onClick={() => setMenu(false)}>
              <span>سرعة التشغيل</span>
            </button>
            {RATES.map((r) => (
              <button key={r} type="button" role="menuitemradio" aria-checked={r === rate} onClick={() => setSpeed(r)}>
                <span>{r === 1 ? "عادية" : `${r}×`}</span>
              </button>
            ))}
          </div>
        )}
        <div className="dp-seek" style={{ "--p": `${pct}%`, "--b": `${Math.max(pct, bufPct)}%` } as CSSProperties}>
          <span className="dp-track" aria-hidden="true" />
          <input
            type="range"
            dir="ltr"
            min={0}
            max={Math.max(1, dur)}
            step={0.1}
            value={Math.min(time, Math.max(1, dur))}
            onChange={(e) => seekTo(Number(e.target.value))}
            disabled={dur <= 0}
            aria-label="موضع التشغيل"
          />
        </div>
        <div className="dp-row">
          <button type="button" onClick={toggle} aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}>
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button type="button" onClick={() => skip(-SKIP)} aria-label={`تأخير ${SKIP} ثوانٍ`} title={`−${SKIP}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></svg>
          </button>
          <button type="button" onClick={() => skip(SKIP)} aria-label={`تقديم ${SKIP} ثوانٍ`} title={`+${SKIP}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" /></svg>
          </button>
          <div className="dp-vol">
            <button type="button" onClick={toggleMute} aria-label={muted || vol === 0 ? "إلغاء الكتم" : "كتم الصوت"}>
              {muted || vol === 0 ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" /></svg>
              )}
            </button>
            <input type="range" dir="ltr" min={0} max={1} step={0.05} value={muted ? 0 : vol} onChange={(e) => changeVol(Number(e.target.value))} aria-label="مستوى الصوت" />
          </div>
          <span className="dp-time" dir="ltr">{fmt(time)} / {fmt(dur)}</span>
          <span className="dp-grow" />
          <button type="button" className="dp-rate" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="سرعة التشغيل">
            {rate === 1 ? "1×" : `${rate}×`}
          </button>
          <button
            type="button"
            className="dp-rate"
            onClick={() => { const el = v(); if (el) el.pause(); onQuality(el?.currentTime ?? 0); }}
            title="الجودات المتاحة في درايف"
            aria-label="اختيار الجودة (يفتح مشغّل درايف)"
          >
            الجودة
          </button>
          {canFs && (
            <button type="button" onClick={toggleFs} aria-label={fs ? "الخروج من ملء الشاشة" : "ملء الشاشة"}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {fs ? <path d="M8 3h2v5H5V6h3V3zm6 0h2v3h3v2h-5V3zM5 16h5v5H8v-3H5v-2zm9 0h5v2h-3v3h-2v-5z" /> : <path d="M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zM5 14h2v3h3v2H5v-5zm12 0h2v5h-5v-2h3v-3z" />}
              </svg>
            </button>
          )}
        </div>
      </div>

      <PlayLoader show={loading} />
    </div>
  );
}
