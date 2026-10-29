"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "@/app/player.css";
import PlayLoader from "@/components/PlayLoader";
import { YT_ID } from "@/lib/youtube";
import { useSettings } from "@/lib/settings";

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
  /** غير موثّقة رسميًا لكنها ما زالت تعمل: تثبّت أدنى/أعلى جودة (setPlaybackQuality ألغاها يوتيوب فلا أثر لها). */
  setPlaybackQualityRange?(min: string, max?: string): void;
  loadVideoById?(o: { videoId: string; startSeconds?: number; suggestedQuality?: string }): void;
  /** غير موثّقة رسميًا: المسارات الصوتية المتعددة (إن وُجدت). */
  getAvailableAudioTracks?(): unknown[]; setAudioTrack?(t: unknown): void;
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

/** الجودة الافتراضية: medium = 360p، تُفرض بتثبيت مدى الجودة (انظر applyQuality) إلى أن يختار الزائر غيرها. */
const DEFAULT_QUALITY = "medium"; // الجودة المطلوبة (medium = 360p)

/**
 * true  = أزرار يوتيوب الأصلية ظاهرة وتعمل (controls=1) مع منع أي خروج إلى يوتيوب:
 *         الإطار sandbox بلا allow-popups ولا allow-top-navigation فلا يفتح الضغط على الشعار/الرابط أي نافذة ولا ينقل الصفحة،
 *         وطبقة شفافة فوق شريط العنوان (نسخ الرابط/مشاهدة لاحقًا/مشاركة) تمنع الضغط عليه أصلًا.
 * false = أزرارنا المخصّصة فوق إطار بلا واجهة يوتيوب.
 */
const NATIVE_CONTROLS = true;

const Q_LABEL: Record<string, string> = {
  highres: "4320p", hd2880: "2880p", hd2160: "2160p", hd1440: "1440p", hd1080: "1080p", hd720: "720p", large: "480p", medium: "360p", small: "240p", tiny: "144p", auto: "تلقائي", default: "تلقائي",
};
/** ارتفاع الفيديو بالبكسل لكل مستوى جودة (يُستعمل لضبط حجم إطار يوتيوب، انظر fit). */
const Q_HEIGHT: Record<string, number> = { tiny: 144, small: 240, medium: 360, large: 480, hd720: 720, hd1080: 1080, hd1440: 1440, hd2160: 2160 };
const Q_FALLBACK = ["hd1080", "hd720", "large", "medium", "small", "tiny"];

const ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3;

/**
 * يطلب جودة من يوتيوب. setPlaybackQuality وحدها لا تؤثر (ألغاها يوتيوب عام 2018)، لذا نثبّت مدى الجودة بـ setPlaybackQualityRange.
 * «default» = تلقائي: نفتح المدى كله ليعود يوتيوب لاختياره.
 */
function applyQuality(p: YTPlayer | null, q: string) {
  if (!p) return;
  try { if (q === "default") p.setPlaybackQualityRange?.("tiny", "highres"); else p.setPlaybackQualityRange?.(q, q); } catch { /* غير مدعوم */ }
  try { p.setPlaybackQuality(q); } catch { /* غير مدعوم */ }
}

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
  const { settings } = useSettings();
  const dpc = settings.watchPage.playBtnScale / 100; // حجم الزر الأوسط من لوحة التحكم
  const noMusicRef = useRef(settings.watchPage.ytNoMusic);
  noMusicRef.current = settings.watchPage.ytNoMusic;
  const audioTried = useRef(false);
  const muteRef = useRef(settings.watchPage.ytMuted);
  muteRef.current = settings.watchPage.ytMuted;
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<number>(-1);
  const [failed, setFailed] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [muted, setMuted] = useState(settings.watchPage.ytMuted);
  const [menu, setMenu] = useState(false);
  const [levels, setLevels] = useState<string[]>(Q_FALLBACK);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const qRef = useRef(DEFAULT_QUALITY);
  const [rate, setRate] = useState(1);
  // زر الوسط يظهر أثناء التشغيل لثوانٍ بعد لمس المشغّل (وهو الوحيد الذي يُشغّل ويوقف).
  const [ctl, setCtl] = useState(false);
  const ctlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showCtl = useCallback(() => {
    setCtl(true);
    if (ctlTimer.current) clearTimeout(ctlTimer.current);
    ctlTimer.current = setTimeout(() => setCtl(false), 2500);
  }, []);
  useEffect(() => () => { if (ctlTimer.current) clearTimeout(ctlTimer.current); }, []);

  /**
   * يوتيوب لم يعد يطيع طلبات الجودة من الـ API، لكنه يختار الجودة التلقائية بحسب حجم الإطار على الشاشة.
   * فنعطي الإطار حجمًا يناسب الجودة المطلوبة (مقسومًا على كثافة الشاشة) ثم نكبّره/نصغّره بـ CSS ليملأ المشغّل، فيراه يوتيوب بالحجم الذي يريده.
   * «default» (تلقائي) يعيد الإطار لحجمه الطبيعي.
   */
  const fit = useCallback((q: string) => {
    const f = frame.current, wrap = host.current;
    if (!f || !wrap) return;
    const h = Q_HEIGHT[q];
    const boxW = wrap.clientWidth, boxH = wrap.clientHeight;
    if (NATIVE_CONTROLS || !h || !boxW || !boxH) { f.style.width = ""; f.style.height = ""; f.style.transform = ""; f.style.transformOrigin = ""; return; }
    const dpr = window.devicePixelRatio || 1;
    // الإطار بنسبة أبعاد المشغّل نفسه (فيبقى شكل الفيديو داخله كما كان)، وارتفاعه يطابق الجودة المطلوبة.
    const ratio = boxW / boxH;
    const w = Math.max(256, (h / dpr) * ratio); // أصغر من هذا لا يعرض يوتيوب الإطار جيدًا
    f.style.width = `${w}px`;
    f.style.height = `${w / ratio}px`;
    f.style.transformOrigin = "0 0";
    f.style.transform = `scale(${boxW / w})`;
  }, []);

  // تغيّر حجم المشغّل (تدوير الجوال، ملء الشاشة…) يغيّر معامل التكبير.
  useEffect(() => {
    const wrap = host.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit(qRef.current));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    if (!YT_ID.test(youtubeId) || !host.current) return;
    let dead = false;
    const wrap = host.current;
    audioTried.current = false;
    qRef.current = DEFAULT_QUALITY; setQuality(DEFAULT_QUALITY); setRate(1); setMenu(false);
    setReady(false); setState(-1); setFailed(false); setCur(0); setDur(0); setBuf(0); setMuted(muteRef.current);

    const q = new URLSearchParams({
      enablejsapi: "1", controls: NATIVE_CONTROLS ? "1" : "0", rel: "0", playsinline: "1", modestbranding: "1", disablekb: NATIVE_CONTROLS ? "0" : "1", fs: NATIVE_CONTROLS ? "1" : "0", iv_load_policy: "3", origin: window.location.origin,
    });
    if (autoplay) q.set("autoplay", "1");
    if (startAt >= 1) q.set("start", String(Math.floor(startAt)));

    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${q}`;
    f.title = `مشغّل يوتيوب — ${title}`;
    f.allow = `accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture${NATIVE_CONTROLS ? "; fullscreen" : ""}`;
    if (NATIVE_CONTROLS) f.allowFullscreen = true;
    f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation"); // بلا allow-popups: لا نوافذ خارجية
    f.referrerPolicy = "strict-origin-when-cross-origin";
    wrap.appendChild(f);
    frame.current = f;
    fit(qRef.current);

    const fallback = setTimeout(() => !dead && setReady(true), 15_000);
    loadApi().then((YT) => {
      if (dead) return;
      player.current = new YT.Player(f, {
        events: {
          onReady: () => { if (!dead) { setReady(true); try { if (muteRef.current) player.current?.mute(); } catch { /* غير مدعوم */ } try { applyQuality(player.current, qRef.current); } catch { /* غير مدعوم */ } } },
          onStateChange: (e) => {
            if (dead) return;
            setState(e.data);
            if (e.data === PLAYING && noMusicRef.current && !audioTried.current) {
              audioTried.current = true;
              // إن وفّر الفيديو مسارًا صوتيًا باسم «بدون موسيقى» نختاره (واجهة غير موثّقة؛ تُتجاهل بصمت إن لم تتوفر).
              try {
                const tracks = player.current?.getAvailableAudioTracks?.() ?? [];
                const hit = tracks.find((t) => /no[\s_-]*music|without[\s_-]*music|music[\s_-]*free|بدون\s*موسيقى|بلا\s*موسيقى|دون\s*موسيقى/i.test(JSON.stringify(t) + String((t as { toString?: () => string })?.toString?.() ?? "")));
                if (hit) player.current?.setAudioTrack?.(hit);
              } catch { /* غير مدعوم */ }
            }
            if (e.data === PLAYING || e.data === BUFFERING) { try { applyQuality(player.current, qRef.current); } catch { /* غير مدعوم */ } }
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
      frame.current = null;
      wrap.replaceChildren();
    };
  }, [youtubeId, title, autoplay, startAt, fit]);

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
    fit(q);
    try {
      applyQuality(p, q);
      // يوتيوب لا يبدّل الجودة أثناء التشغيل من تلقاء نفسه: نعيد تحميل الفيديو من اللحظة الحالية فتُطبَّق الجودة المطلوبة.
      if ((state === PLAYING || state === BUFFERING) && p.loadVideoById) {
        p.loadVideoById({ videoId: youtubeId, startSeconds: p.getCurrentTime() || 0, suggestedQuality: q === "default" ? undefined : q });
        setTimeout(() => { try { applyQuality(player.current, q); player.current?.setPlaybackRate(rate); } catch { /* غير مدعوم */ } }, 600);
      } else {
        p.seekTo(p.getCurrentTime() || 0, true);
      }
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

  if (NATIVE_CONTROLS) {
    return (
      <div ref={box} className="player player--yt player--native dp">
        <div ref={host} className="yt-host" />
        {failed ? (
          <span className="soon">تعذّر تشغيل الفيديو</span>
        ) : (
          <>
            {/* حاجز شفاف فوق شريط عنوان يوتيوب (الشعار/نسخ الرابط/مشاهدة لاحقًا/مشاركة) كي لا يُضغط عليه. */}
            <div className="yt-guard yt-guard--top" aria-hidden="true" />
            {/* عند الانتهاء نغطّي الإطار كي لا تظهر مقترحات يوتيوب، ونعرض زر إعادة التشغيل. */}
            {ready && state === ENDED && (
              <div className="yt-cover">
                <button type="button" className="dp-center" onClick={toggle} aria-label="إعادة التشغيل">{I.play}</button>
              </div>
            )}
          </>
        )}
        <PlayLoader show={!ready && !failed} />
      </div>
    );
  }

  const playing = state === PLAYING || state === BUFFERING;
  // غلاف أسود عند الإيقاف/الانتهاء فلا تظهر مقترحات يوتيوب (الحلقات الأخرى) فوق الإطار.
  // قبل أول تشغيل (-1 / 5) نغطّي الإطار أيضًا بصورة الفيديو المصغّرة كي لا يظهر زر يوتيوب الأوسط تحت زرّنا.
  const idle = state === -1 || state === 5;
  const covered = ready && (state === PAUSED || state === ENDED || idle);
  const p = dur > 0 ? (cur / dur) * 100 : 0;
  const centerShown = ready && (!playing || ctl);

  return (
    <div
      ref={box}
      className={`player player--yt dp${centerShown ? " yt-hole" : ""}${idle && ready ? " yt-idle" : ""}`}
      style={{ ["--dpc" as string]: dpc }}
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
          {covered && <div className="yt-cover" aria-hidden="true" style={idle ? { backgroundImage: `url(https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg)` } : undefined} />}
          {/* على اللمس: زر الوسط لا يستقبل اللمس بنفسه؛ نفتح «ثقبًا» في الطبقة بمقاسه فيصل اللمسُ الحقيقي إلى إطار يوتيوب
              (الجوال يمنع playVideo() القادم من الصفحة إن لم يكن اللمس داخل الإطار نفسه) ويشغّل/يوقف يوتيوب مباشرة. */}
          {/* طبقة تلتقط كل اللمس/النقر: تمنع شعار يوتيوب وشريطه العلوي وأي ضغط على الإطار نفسه.
              على الحاسوب النقر عليها يشغّل/يوقف؛ على اللمس وسطها مثقوب (انظر player.css). */}
          <div
            className="dp-surface yt-surface"
            onClick={() => {
              if (menu) { setMenu(false); return; }
              // قبل أول تشغيل على اللمس: وسط الفيديو مثقوب ويصل لزر يوتيوب نفسه؛ ما يصل هنا لمس الأطراف فقط.
              if (idle && typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) { showCtl(); return; }
              // غير ذلك (حاسوب، أو جوال بعد البدء): الضغط على أي مكان في الفيديو يشغّل/يوقف.
              toggle();
            }}
            aria-hidden="true"
          />
          {centerShown && (
            <button
              type="button"
              className="dp-center"
              onClick={() => { toggle(); if (playing) setCtl(false); else showCtl(); }}
              aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
            >
              {playing ? I.pause : I.play}
            </button>
          )}
      {menu && (
        <div className="yt-menu" role="menu" aria-label="الإعدادات">
          <div className="yt-menu-row yt-menu-row--col" role="group" aria-label="الجودة">
            <b>الجودة</b>
            {[...levels, "default"].map((q) => (
              <button key={q} type="button" role="menuitemradio" aria-checked={quality === q} onClick={() => pickQuality(q)}>
                {Q_LABEL[q]}
              </button>
            ))}
          </div>
          <div className="yt-menu-row" role="group" aria-label="السرعة">
            <b>السرعة</b>
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
              <button key={r} type="button" role="menuitemradio" aria-checked={rate === r} onClick={() => pickRate(r)} dir="ltr">
                {r === 1 ? "1×" : `${r}×`}
              </button>
            ))}
          </div>
        </div>
      )}
          <div className="dp-ui">
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
