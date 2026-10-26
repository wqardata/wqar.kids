"use client";
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent, type MouseEvent,
} from "react";
import "@/app/player.css";
import Icon from "@/components/Icon";
import PlayLoader from "@/components/PlayLoader";
import { DRIVE_ID, driveThumbnail } from "@/lib/drive";
import { driveVideoUrls } from "@/lib/driveVideo";

/** نسخة أخرى من الفيديو بجودة مختلفة (ملف درايف مستقل). اختياري. */
export type Quality = { label: string; driveId: string };

type Props = {
  driveId?: string;
  title: string;
  hue: number;
  autoplay?: boolean;
  /** ثوانٍ: بدء التشغيل من هذه اللحظة. */
  startAt?: number;
  /** جودات إضافية، مثل [{ label: "720p", driveId: "..." }]. تظهر في قائمة «الجودة». */
  qualities?: Quality[];
};

const EMPTY: Quality[] = [];
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIPS = [5, 10, 15, 30];
const LS = { rate: "dp:rate", skip: "dp:skip", vol: "dp:vol", muted: "dp:muted" };
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* التخزين غير متاح */ }
}
function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(x).padStart(2, "0")}`;
}

type IcoName = "play" | "pause" | "back" | "fwd" | "vol" | "mute" | "fs" | "fsx" | "pip" | "chev" | "check";
function Ico({ name, n }: { name: IcoName; n?: number }) {
  const c = { width: 24, height: 24, viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const;
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (name) {
    case "play": return <svg {...c} fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
    case "pause": return <svg {...c} fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>;
    case "back": return <svg {...c} {...s}><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" /><text x="12" y="15.3" fontSize="7.4" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">{n}</text></svg>;
    case "fwd": return <svg {...c} {...s}><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5" /><text x="12" y="15.3" fontSize="7.4" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">{n}</text></svg>;
    case "vol": return <svg {...c} fill="currentColor"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    case "mute": return <svg {...c} fill="currentColor"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    case "fs": return <svg {...c} {...s}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
    case "fsx": return <svg {...c} {...s}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>;
    case "pip": return <svg {...c} {...s}><path d="M3 5.5h18v13H3zM12 11.5h7v5.5h-7z" /></svg>;
    case "chev": return <svg {...c} {...s}><path d="M9 6l6 6-6 6" /></svg>;
    case "check": return <svg {...c} {...s}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  }
}

type Menu = null | "main" | "rate" | "quality" | "skip";
type Webkit = HTMLElement & { webkitRequestFullscreen?: () => void };
type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
type WebkitDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };

export default function DrivePlayer({ driveId, title, hue, autoplay = false, startAt = 0, qualities = EMPTY }: Props) {
  if (driveId && DRIVE_ID.test(driveId)) {
    // key: عند تغيّر الفيديو تُصفَّر كل حالة المشغّل.
    return <Player key={driveId} driveId={driveId} title={title} autoplay={autoplay} startAt={startAt} qualities={qualities} />;
  }
  return (
    <div className="player" role="img" aria-label={`الفيديو غير متوفر بعد — ${title}`} style={{ "--h": hue } as CSSProperties}>
      <span className="play"><Icon name="play" size={34} /></span>
      <span className="soon">الفيديو غير متوفر بعد</span>
    </div>
  );
}

function Player({ driveId, title, autoplay, startAt, qualities }: { driveId: string; title: string; autoplay: boolean; startAt: number; qualities: Quality[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const vref = useRef<HTMLVideoElement>(null);
  const resume = useRef<{ t: number; play: boolean } | null>(startAt >= 1 || autoplay ? { t: startAt, play: autoplay } : null);
  const hideT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tap = useRef<{ t: number; side: number; timer?: ReturnType<typeof setTimeout> }>({ t: 0, side: 0 });

  const sources = useMemo<Quality[]>(
    () => [{ label: "الأصلي", driveId }, ...qualities.filter((q) => DRIVE_ID.test(q.driveId))],
    [driveId, qualities],
  );
  const [qi, setQi] = useState(0);
  const [si, setSi] = useState(0); // رقم الرابط الجاري تجربته من driveVideoUrls
  const rateRef = useRef(1);
  const [frame, setFrame] = useState(false); // true = مشغّل درايف الأصلي (احتياطي أو باختيار المستخدم)
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [rate, setRate] = useState(1);
  const [skip, setSkip] = useState(10);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [ui, setUi] = useState(true);
  const [fs, setFs] = useState(false);
  const [pipOk, setPipOk] = useState(false);
  const [flash, setFlash] = useState<{ side: number; n: number } | null>(null);

  const urls = useMemo(() => driveVideoUrls(sources[qi]?.driveId ?? driveId), [sources, qi, driveId]);
  const src = urls[Math.min(si, urls.length - 1)];
  const showUi = ui || !playing || menu !== null;

  // التفضيلات المحفوظة (السرعة، مدة القفز، الصوت).
  useEffect(() => {
    const r = Number(lsGet(LS.rate)), k = Number(lsGet(LS.skip)), v = lsGet(LS.vol);
    if (RATES.includes(r)) { setRate(r); rateRef.current = r; }
    if (SKIPS.includes(k)) setSkip(k);
    if (v !== null && Number.isFinite(Number(v))) setVol(Math.min(1, Math.max(0, Number(v))));
    setMuted(lsGet(LS.muted) === "1");
    setPipOk(typeof document !== "undefined" && !!document.pictureInPictureEnabled);
  }, []);

  // يخبر التنسيق (globals.css) بنوع المشغّل كي يضبط ارتفاع «الفراغ» في المشغّل المشترك على الجوال.
  useIsoLayoutEffect(() => {
    document.documentElement.dataset.dpm = frame ? "frame" : "native";
    return () => { delete document.documentElement.dataset.dpm; };
  }, [frame]);

  // فشل الرابط الحالي: جرّب الرابط التالي من نفس الموضع، وإن انتهت الروابط ننتقل لمشغّل درايف الأصلي.
  const failover = useCallback(() => {
    const v = vref.current;
    if (v && v.currentTime > 0) resume.current = { t: v.currentTime, play: !v.paused };
    if (si + 1 < urls.length) {
      setReady(false);
      setSi(si + 1);
    } else {
      setFrame(true);
    }
  }, [si, urls.length]);

  // إن لم تصل بيانات الفيديو خلال مهلة، نجرّب الرابط التالي ثم مشغّل درايف الأصلي.
  useEffect(() => {
    if (frame || ready) return;
    const t = setTimeout(failover, 8_000);
    return () => clearTimeout(t);
  }, [frame, ready, failover]);

  // سباق التهيئة: المتصفح يبدأ تحميل <video> من HTML الخادم قبل أن يربط React مستمعيه، فقد يفوته
  // loadedmetadata/error فيبقى المشغّل على شاشة التحميل. نقرأ حالة العنصر الفعلية عند التركيب.
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    if (v.error) failover();
    else if (v.readyState >= 1) onMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // شاشة التحميل فوق إطار درايف: احتياط إن لم يصل حدث التحميل.
  useEffect(() => {
    if (!frame) return;
    setFrameLoaded(false);
    const t = setTimeout(() => setFrameLoaded(true), 15_000);
    return () => clearTimeout(t);
  }, [frame, qi]);

  useEffect(() => {
    const on = () => setFs(!!(document.fullscreenElement || (document as WebkitDoc).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => () => { clearTimeout(hideT.current); clearTimeout(tap.current.timer); }, []);

  const poke = useCallback(() => {
    setUi(true);
    clearTimeout(hideT.current);
    hideT.current = setTimeout(() => setUi(false), 3200);
  }, []);

  const toggle = useCallback(() => {
    const v = vref.current;
    if (!v) return;
    if (v.paused || v.ended) void v.play().catch(() => {});
    else v.pause();
    poke();
  }, [poke]);

  const seekBy = useCallback((d: number) => {
    const v = vref.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + d));
    setCur(v.currentTime);
    poke();
  }, [poke]);

  const toggleMute = useCallback(() => {
    const v = vref.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
    poke();
  }, [poke]);

  const toggleFs = useCallback(() => {
    const d = document as WebkitDoc;
    if (document.fullscreenElement || d.webkitFullscreenElement) {
      void (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      return;
    }
    const el = wrap.current as Webkit | null;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
    else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else (vref.current as WebkitVideo | null)?.webkitEnterFullscreen?.(); // آيفون: مشغّله الأصلي
  }, []);

  const togglePip = useCallback(() => {
    const v = vref.current;
    if (!v) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => {});
    else void v.requestPictureInPicture?.().catch(() => {});
  }, []);

  const pickRate = (r: number) => {
    setRate(r);
    rateRef.current = r;
    if (vref.current) vref.current.playbackRate = r;
    lsSet(LS.rate, String(r));
    setMenu(null);
  };
  const pickSkip = (k: number) => {
    setSkip(k);
    lsSet(LS.skip, String(k));
    setMenu(null);
  };
  const pickQuality = (i: number) => {
    setMenu(null);
    if (i === qi) return;
    const v = vref.current;
    resume.current = { t: v?.currentTime ?? 0, play: v ? !v.paused : false };
    setReady(false);
    setSi(0);
    setQi(i);
  };

  // أزرار الإشعارات/قفل الشاشة في الهاتف.
  useEffect(() => {
    if (frame || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title });
      navigator.mediaSession.setActionHandler("seekbackward", () => seekBy(-skip));
      navigator.mediaSession.setActionHandler("seekforward", () => seekBy(skip));
    } catch { /* غير مدعوم */ }
  }, [frame, title, skip, seekBy]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (tag === "BUTTON" && (e.key === " " || e.key === "Enter")) return;
    const k = e.key.toLowerCase();
    let handled = true;
    if (k === " " || k === "k") toggle();
    else if (k === "arrowleft" || k === "j") { seekBy(-skip); setFlash({ side: -1, n: Date.now() }); }
    else if (k === "arrowright" || k === "l") { seekBy(skip); setFlash({ side: 1, n: Date.now() }); }
    else if (k === "f") toggleFs();
    else if (k === "m") toggleMute();
    else if (k === "escape" && menu) setMenu(null);
    else handled = false;
    if (handled) e.preventDefault();
  };

  const onSurface = (e: MouseEvent<HTMLDivElement>) => {
    if (menu) { setMenu(null); return; }
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!coarse) { toggle(); return; } // الفأرة: نقرة = تشغيل/إيقاف، ونقرتان = ملء الشاشة
    // اللمس: لمسة واحدة تُظهر الأزرار، ولمستان سريعتان على اليسار/اليمين تقدّمان أو تُرجعان.
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const side = x < 0.33 ? -1 : x > 0.67 ? 1 : 0;
    const now = Date.now();
    const t = tap.current;
    clearTimeout(t.timer);
    if (side !== 0 && t.side === side && now - t.t < 320) {
      tap.current = { t: 0, side: 0 };
      seekBy(side * skip);
      setFlash({ side, n: now });
      return;
    }
    const hidden = !showUi;
    tap.current = { t: now, side, timer: setTimeout(() => (hidden ? poke() : toggle()), 320) };
  };

  const onMeta = () => {
    const v = vref.current;
    if (!v) return;
    setDur(v.duration);
    setReady(true);
    v.playbackRate = rateRef.current;
    const r = resume.current;
    resume.current = null;
    if (r) {
      if (r.t > 0 && Number.isFinite(v.duration)) v.currentTime = Math.min(r.t, Math.max(0, v.duration - 0.5));
      if (r.play) void v.play().catch(() => {});
    }
  };
  const onTime = () => {
    const v = vref.current;
    if (!v) return;
    setCur(v.currentTime);
    let end = 0;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= v.currentTime + 0.5 && v.currentTime <= v.buffered.end(i)) end = v.buffered.end(i);
    }
    setBuf(end);
  };
  const onVolume = () => {
    const v = vref.current;
    if (!v) return;
    setVol(v.volume);
    setMuted(v.muted);
    lsSet(LS.vol, String(v.volume));
    lsSet(LS.muted, v.muted ? "1" : "0");
  };

  // ---------- مشغّل درايف الأصلي (احتياطي، ويملك قائمة جودة درايف 360p–1080p) ----------
  if (frame) {
    const q = new URLSearchParams();
    if (autoplay) q.set("autoplay", "1");
    if (cur >= 1 || startAt >= 1) q.set("t", String(Math.floor(cur >= 1 ? cur : startAt)));
    const qs = q.toString();
    return (
      <div className="player player--frame dp-frame">
        <iframe
          src={`https://drive.google.com/file/d/${sources[qi]?.driveId ?? driveId}/preview${qs ? `?${qs}` : ""}`}
          title={`مشغّل الفيديو — ${title}`}
          allow="autoplay; fullscreen"
          allowFullScreen
          loading={autoplay ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onLoad={() => setFrameLoaded(true)}
        />
        <PlayLoader show={!frameLoaded} />
        <button type="button" className="dp-chip" onClick={() => { resume.current = { t: cur, play: false }; setReady(false); setSi(0); setFrame(false); }}>
          المشغّل المخصّص
        </button>
      </div>
    );
  }

  // ---------- المشغّل المخصّص ----------
  const pct = (x: number) => `${dur > 0 ? Math.min(100, Math.max(0, (x / dur) * 100)) : 0}%`;
  const rateLabel = (r: number) => (r === 1 ? "عادية" : `${r}×`);
  const poster = driveThumbnail(driveId, 960);

  return (
    <div
      ref={wrap}
      className={`player dp${showUi ? "" : " dp--idle"}${fs ? " dp--fs" : ""}`}
      tabIndex={0}
      role="group"
      aria-label={`مشغّل الفيديو — ${title}`}
      onKeyDown={onKey}
      onPointerMove={(e) => e.pointerType === "mouse" && poke()}
      onDoubleClick={() => !window.matchMedia("(pointer: coarse)").matches && toggleFs()}
    >
      <video
        ref={vref}
        className="dp-video"
        src={src}
        poster={poster}
        playsInline
        preload={autoplay ? "auto" : "metadata"}
        onLoadedMetadata={onMeta}
        onDurationChange={() => vref.current && setDur(vref.current.duration)}
        onTimeUpdate={onTime}
        onProgress={onTime}
        onPlay={() => { setPlaying(true); poke(); }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onVolumeChange={onVolume}
        onError={failover}
      />
      <div className="dp-surface" onClick={onSurface} />
      <PlayLoader show={!ready} />
      {ready && buffering && playing && <span className="dp-spin" aria-hidden="true" />}
      {flash && (
        <div key={flash.n} className={`dp-flash dp-flash--${flash.side > 0 ? "fwd" : "back"}`} aria-hidden="true">
          {flash.side > 0 ? "+" : "−"}{skip} ث
        </div>
      )}
      {ready && !playing && (
        <button type="button" className="dp-center" onClick={toggle} aria-label="تشغيل">
          <Ico name="play" />
        </button>
      )}

      <div className="dp-ui" onPointerDown={poke}>
        <div className="dp-seek" style={{ "--p": pct(cur), "--b": pct(buf) } as CSSProperties}>
          <div className="dp-track" />
          <input
            type="range"
            min={0}
            max={dur || 0}
            step={0.1}
            value={Math.min(cur, dur || 0)}
            aria-label="شريط التقدّم"
            aria-valuetext={`${fmt(cur)} من ${fmt(dur)}`}
            onChange={(e) => {
              const v = vref.current;
              if (!v) return;
              v.currentTime = Number(e.target.value);
              setCur(v.currentTime);
            }}
          />
        </div>

        <div className="dp-row">
          <button type="button" onClick={toggle} aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}>
            <Ico name={playing ? "pause" : "play"} />
          </button>
          <button type="button" onClick={() => seekBy(-skip)} aria-label={`رجوع ${skip} ثوانٍ`} title={`رجوع ${skip} ث (←)`}>
            <Ico name="back" n={skip} />
          </button>
          <button type="button" onClick={() => seekBy(skip)} aria-label={`تقديم ${skip} ثوانٍ`} title={`تقديم ${skip} ث (→)`}>
            <Ico name="fwd" n={skip} />
          </button>
          <span className="dp-time" dir="ltr">{fmt(cur)} / {fmt(dur)}</span>
          <span className="dp-grow" />

          <div className="dp-vol">
            <button type="button" onClick={toggleMute} aria-label={muted || vol === 0 ? "تشغيل الصوت" : "كتم الصوت"}>
              <Ico name={muted || vol === 0 ? "mute" : "vol"} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : vol}
              aria-label="مستوى الصوت"
              onChange={(e) => {
                const v = vref.current;
                if (!v) return;
                v.volume = Number(e.target.value);
                v.muted = v.volume === 0;
              }}
            />
          </div>

          <button type="button" className="dp-rate" onClick={() => setMenu(menu === "rate" ? null : "rate")} aria-label="سرعة التشغيل">
            {rate}×
          </button>
          <button type="button" onClick={() => setMenu(menu ? null : "main")} aria-label="الإعدادات" aria-expanded={menu !== null} title="الإعدادات">
            <Icon name="gear" size={22} />
          </button>
          {pipOk && (
            <button type="button" className="dp-pip" onClick={togglePip} aria-label="نافذة عائمة" title="نافذة عائمة">
              <Ico name="pip" />
            </button>
          )}
          <button type="button" onClick={toggleFs} aria-label={fs ? "إنهاء ملء الشاشة" : "ملء الشاشة"} title="ملء الشاشة (F)">
            <Ico name={fs ? "fsx" : "fs"} />
          </button>
        </div>

        {menu && (
          <div className="dp-menu" role="menu" dir="rtl" onPointerDown={(e) => e.stopPropagation()}>
            {menu === "main" && (
              <>
                <button type="button" role="menuitem" onClick={() => setMenu("rate")}>
                  <span>سرعة التشغيل</span><small>{rateLabel(rate)}</small><Ico name="chev" />
                </button>
                <button type="button" role="menuitem" onClick={() => setMenu("quality")}>
                  <span>الجودة</span><small>{sources[qi]?.label}</small><Ico name="chev" />
                </button>
                <button type="button" role="menuitem" onClick={() => setMenu("skip")}>
                  <span>مدة التقديم والتأخير</span><small>{skip} ث</small><Ico name="chev" />
                </button>
              </>
            )}
            {menu !== "main" && (
              <button type="button" className="dp-menu-head" onClick={() => setMenu("main")}>
                <Ico name="chev" />
                <span>{menu === "rate" ? "سرعة التشغيل" : menu === "quality" ? "الجودة" : "مدة التقديم والتأخير"}</span>
              </button>
            )}
            {menu === "rate" && RATES.map((r) => (
              <button key={r} type="button" role="menuitemradio" aria-checked={r === rate} onClick={() => pickRate(r)}>
                <span>{rateLabel(r)}</span>{r === rate && <Ico name="check" />}
              </button>
            ))}
            {menu === "skip" && SKIPS.map((k) => (
              <button key={k} type="button" role="menuitemradio" aria-checked={k === skip} onClick={() => pickSkip(k)}>
                <span>{k} ثانية</span>{k === skip && <Ico name="check" />}
              </button>
            ))}
            {menu === "quality" && (
              <>
                {sources.map((s, i) => (
                  <button key={`${s.driveId}-${i}`} type="button" role="menuitemradio" aria-checked={i === qi} onClick={() => pickQuality(i)}>
                    <span>{s.label}</span>{i === qi && <Ico name="check" />}
                  </button>
                ))}
                <button type="button" role="menuitem" onClick={() => { setMenu(null); setFrame(true); }}>
                  <span>مشغّل درايف (360p – 1080p)</span>
                </button>
                <p className="dp-menu-note">«الأصلي» هو جودة الملف المرفوع نفسه. لاختيار 360p أو 720p أو 1080p استخدم مشغّل درايف.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
