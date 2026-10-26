"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "@/app/player.css";
import PlayLoader from "@/components/PlayLoader";
import { YT_ID } from "@/lib/youtube";

/**
 * مشغّل يوتيوب بواجهتنا نحن (IFrame API مع controls=0) كي لا يظهر شيء من واجهة يوتيوب:
 *  - لا حلقات مقترحة ولا «المزيد من الفيديوهات» (نغطّي الإطار بغلاف أسود عند الإيقاف وعند الانتهاء).
 *  - لا شريط العنوان الذي فيه «نسخ الرابط» و«مشاهدة لاحقًا» و«مشاركة» (طبقة شفافة تمنع وصول الفأرة/اللمس للإطار).
 *  - لا نوافذ خارجية (sandbox بلا allow-popups).
 * لا يمرّ على خادم الموقع.
 */

type YTPlayer = {
  playVideo(): void; pauseVideo(): void; seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number; getDuration(): number; getVideoLoadedFraction(): number;
  setPlaybackQuality(q: string): void; getAvailableQualityLevels(): string[]; getPlaybackQuality(): string;
  setPlaybackRate(r: number): void; getPlaybackRate(): number; getAvailablePlaybackRates(): number[];
  mute(): void; unMute(): void; isMuted(): boolean; destroy(): void;
};
type YTApi = { Player: new (el: HTMLIFrameElement, o: { events: { onReady: () => void; onStateChange: (e: { data: number }) => void; onError: () => void } }) => YTPlayer };
declare global {
  interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YTApi> | null = null;
function loadApi(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTApi>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); if (window.YT) resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => { apiPromise = null; reject(new Error("yt-api")); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

/** الجودة الافتراضية: small = 240p. يوتيوب يعامل هذا الطلب كاقتراح فقط وقد يتجاهله (مثلًا مع تغيّر الشبكة). */
const DEFAULT_QUALITY = "small";

const Q_LABEL: Record<string, string> = {
  highres: "4320p", hd2880: "2880p", hd2160: "2160p", hd1440: "1440p", hd1080: "1080p", hd720: "720p", large: "480p", medium: "360p", small: "240p", tiny: "144p", auto: "تلقائي", default: "تلقائي",
};
const Q_FALLBACK = ["hd1080", "hd720", "large", "medium", "small", "tiny"];

const ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3;

function fmt(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

const I = {
  play: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>,
  pause: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>,
  vol: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" /></svg>,
  mute: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z" /></svg>,
  gear: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4L10.7 6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.3 2.7h4l.3-2.7a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" /></svg>,
  full: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zM5 14h2v3h3v2H5v-5zm12 0h2v5h-5v-2h3v-3z" /></svg>,
};

export default function YouTubePlayer({ youtubeId, title, autoplay = false, startAt = 0 }: { youtubeId: string; title: string; autoplay?: boolean; startAt?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<number>(-1);
  const [failed, setFailed] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [muted, setMuted] = useState(false);
  const [menu, setMenu] = useState(false);
  const [levels, setLevels] = useState<string[]>(Q_FALLBACK);
  const [quality, setQuality] = useState(DEFAULT_QUALITY); // الجودة المطلوبة (small = 240p)
  const qRef = useRef(DEFAULT_QUALITY);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    if (!YT_ID.test(youtubeId) || !host.current) return;
    let dead = false;
    const wrap = host.current;
    qRef.current = DEFAULT_QUALITY; setQuality(DEFAULT_QUALITY); setRate(1); setMenu(false);
    setReady(false); setState(-1); setFailed(false); setCur(0); setDur(0); setBuf(0);

    const q = new URLSearchParams({
      enablejsapi: "1", controls: "0", rel: "0", playsinline: "1", modestbranding: "1", disablekb: "1", fs: "0", iv_load_policy: "3", origin: window.location.origin,
    });
    if (autoplay) q.set("autoplay", "1");
    if (startAt >= 1) q.set("start", String(Math.floor(startAt)));

    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${q}`;
    f.title = `مشغّل يوتيوب — ${title}`;
    f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
    f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation"); // بلا allow-popups: لا نوافذ خارجية
    f.referrerPolicy = "strict-origin-when-cross-origin";
    wrap.appendChild(f);

    const fallback = setTimeout(() => !dead && setReady(true), 15_000);
    loadApi().then((YT) => {
      if (dead) return;
      player.current = new YT.Player(f, {
        events: {
          onReady: () => { if (!dead) { setReady(true); try { player.current?.setPlaybackQuality(qRef.current); } catch { /* غير مدعوم */ } } },
          onStateChange: (e) => {
            if (dead) return;
            setState(e.data);
            if (e.data === PLAYING || e.data === BUFFERING) { try { player.current?.setPlaybackQuality(qRef.current); } catch { /* غير مدعوم */ } }
          },
          onError: () => { if (!dead) setFailed(true); },
        },
      });
    }).catch(() => !dead && setFailed(true));

    return () => {
      dead = true;
      clearTimeout(fallback);
      try { player.current?.destroy(); } catch { /* الإطار أُزيل */ }
      player.current = null;
      wrap.replaceChildren();
    };
  }, [youtubeId, title, autoplay, startAt]);

  // تحديث الوقت والشريط أثناء التشغيل.
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      const p = player.current;
      if (!p || typeof p.getCurrentTime !== "function") return;
      setCur(p.getCurrentTime() || 0);
      setDur(p.getDuration() || 0);
      setBuf(p.getVideoLoadedFraction() || 0);
    }, 300);
    return () => clearInterval(t);
  }, [ready]);

  const toggle = useCallback(() => {
    const p = player.current;
    if (!p) return;
    if (state === PLAYING || state === BUFFERING) p.pauseVideo();
    else if (state === ENDED) { p.seekTo(0, true); p.playVideo(); }
    else p.playVideo();
  }, [state]);

  const openMenu = () => {
    const p = player.current;
    try {
      const l = (p?.getAvailableQualityLevels() ?? []).filter((x) => x !== "auto" && Q_LABEL[x]);
      if (l.length) setLevels(l);
    } catch { /* نبقى على القائمة الافتراضية */ }
    setMenu((m) => !m);
  };
  const pickQuality = (q: string) => {
    const p = player.current;
    qRef.current = q; setQuality(q); setMenu(false);
    if (!p) return;
    try {
      p.setPlaybackQuality(q);
      // يوتيوب يتجاهل الطلب أحيانًا أثناء التشغيل؛ إعادة التموضع في اللحظة نفسها تجبره على تحميل الجودة الجديدة.
      p.seekTo(p.getCurrentTime() || 0, true);
    } catch { /* غير مدعوم */ }
  };
  const pickRate = (r: number) => { setRate(r); setMenu(false); try { player.current?.setPlaybackRate(r); } catch { /* غير مدعوم */ } };

  const seek = (s: number) => { player.current?.seekTo(s, true); setCur(s); };
  const toggleMute = () => {
    const p = player.current;
    if (!p) return;
    if (p.isMuted()) { p.unMute(); setMuted(false); } else { p.mute(); setMuted(true); }
  };
  const fullscreen = () => {
    const el = box.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };

  if (!YT_ID.test(youtubeId)) {
    return <div className="player" role="img" aria-label={`الفيديو غير متوفر — ${title}`}><span className="soon">الفيديو غير متوفر</span></div>;
  }

  const playing = state === PLAYING || state === BUFFERING;
  // غلاف أسود عند الإيقاف/الانتهاء فلا تظهر مقترحات يوتيوب (الحلقات الأخرى) فوق الإطار.
  const covered = ready && (state === PAUSED || state === ENDED);
  const p = dur > 0 ? (cur / dur) * 100 : 0;

  return (
    <div
      ref={box}
      className="player player--yt dp"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
        else if (e.key === "ArrowRight") seek(Math.min(dur, cur + 10));
        else if (e.key === "ArrowLeft") seek(Math.max(0, cur - 10));
        else if (e.key === "f") fullscreen();
      }}
    >
      <div ref={host} className="yt-host" />
      {failed ? (
        <span className="soon">تعذّر تشغيل الفيديو</span>
      ) : (
        <>
          {covered && <div className="yt-cover" aria-hidden="true" />}
          {/* طبقة تلتقط كل اللمس/النقر: تمنع شعار يوتيوب وشريطه العلوي وأي ضغط على الإطار نفسه. */}
          <div className="dp-surface yt-surface" onClick={() => { if (menu) setMenu(false); else toggle(); }} aria-hidden="true" />
          {!playing && ready && (
            <button type="button" className="dp-center" onClick={toggle} aria-label="تشغيل">{I.play}</button>
          )}
          <div className="dp-ui">
            {menu && (
              <div className="dp-menu" role="menu" aria-label="الإعدادات">
                <button type="button" className="dp-menu-head" onClick={() => setMenu(false)}><span>الجودة</span></button>
                {[...levels, "default"].map((q) => (
                  <button key={q} type="button" role="menuitemradio" aria-checked={quality === q} onClick={() => pickQuality(q)}>
                    <span>{Q_LABEL[q]}{q === DEFAULT_QUALITY ? " (الافتراضي)" : ""}</span>
                  </button>
                ))}
                <button type="button" className="dp-menu-head" onClick={() => setMenu(false)}><span>السرعة</span></button>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                  <button key={r} type="button" role="menuitemradio" aria-checked={rate === r} onClick={() => pickRate(r)}>
                    <span dir="ltr">{r === 1 ? "عادية" : `${r}×`}</span>
                  </button>
                ))}
                <p className="dp-menu-note">قد يتجاهل يوتيوب الجودة المطلوبة إذا كانت الشبكة بطيئة أو لم تتوفر.</p>
              </div>
            )}
            <div className="dp-seek" style={{ ["--p" as string]: `${p}%`, ["--b" as string]: `${Math.max(p, buf * 100)}%` }}>
              <div className="dp-track" />
              <input type="range" min={0} max={Math.max(1, dur)} step={0.5} value={Math.min(cur, Math.max(1, dur))} onChange={(e) => seek(Number(e.target.value))} aria-label="موضع التشغيل" disabled={!ready || dur <= 0} />
            </div>
            <div className="dp-row">
              <button type="button" onClick={toggle} aria-label={playing ? "إيقاف مؤقت" : "تشغيل"} disabled={!ready}>{playing ? I.pause : I.play}</button>
              <button type="button" onClick={toggleMute} aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"} disabled={!ready}>{muted ? I.mute : I.vol}</button>
              <span className="dp-time" dir="ltr">{fmt(cur)} / {fmt(dur)}</span>
              <span className="dp-grow" />
              <button type="button" onClick={openMenu} aria-label="الإعدادات: الجودة والسرعة" aria-haspopup="menu" aria-expanded={menu} disabled={!ready}>{I.gear}</button>
              <button type="button" onClick={fullscreen} aria-label="ملء الشاشة" disabled={!ready}>{I.full}</button>
            </div>
          </div>
        </>
      )}
      <PlayLoader show={!ready && !failed} />
    </div>
  );
}
