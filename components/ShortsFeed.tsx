"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { viewsAndAge } from "@/lib/format";
import Icon from "@/components/Icon";
import PlayLoader from "@/components/PlayLoader";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { recordView } from "@/lib/history";
import { countView, toVideo, type VideoDoc } from "@/lib/videos";

// معرّفات درايف تتكوّن من حروف وأرقام و _ و - فقط؛ نرفض غير ذلك لأمان الرابط.
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

type Slide = { key: string; video: VideoDoc };

function shuffled<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * مقاطع قصيرة بملء الشاشة بترتيب عشوائي، والتقليب بالسحب العمودي كشورتس يوتيوب.
 * مشغّل درايف الحالي وحده يُحمَّل؛ البقية صور مصغّرة حتى يصلها المستخدم.
 */
export default function ShortsFeed() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [pool, setPool] = useState<VideoDoc[]>([]);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [active, setActive] = useState(0);
  // الشريحة التي فتحنا فيها المشغّل مؤقتًا للمس (تشغيل/إيقاف) بدل السحب.
  const [touchable, setTouchable] = useState(-1);
  const [loadedKey, setLoadedKey] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const batch = useRef(0);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const makeBatch = useCallback((videos: readonly VideoDoc[]): Slide[] => {
    batch.current += 1;
    return shuffled(videos).map((v) => ({ key: `${batch.current}-${v.id}`, video: v }));
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(200)))
      .then((snap) => {
        if (off) return;
        const shorts = snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => v.isShort && !v.hidden && DRIVE_ID.test(v.driveId));
        setPool(shorts);
        setSlides(makeBatch(shorts));
      })
      .catch(() => {})
      .finally(() => !off && setReady(true));
    return () => {
      off = true;
    };
  }, [makeBatch]);

  // الشريحة الظاهرة أكثر من 60% هي الحالية.
  useEffect(() => {
    const root = feedRef.current;
    if (!root || slides.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll("[data-i]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [slides]);

  // قرب النهاية: نضيف دفعة عشوائية جديدة فلا ينتهي التقليب.
  useEffect(() => {
    if (pool.length > 1 && slides.length > 0 && active >= slides.length - 2) setSlides((s) => [...s, ...makeBatch(pool)]);
  }, [active, pool, slides.length, makeBatch]);

  // عدّ المشاهدة وتسجيلها في السجل عند الوصول للمقطع.
  useEffect(() => {
    const v = slides[active]?.video;
    if (!v) return;
    recordView(v.id);
    void countView(v.id);
  }, [active, slides]);

  useEffect(() => {
    setTouchable(-1);
    return () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
    };
  }, [active]);

  const go = useCallback((i: number) => {
    const root = feedRef.current;
    if (!root) return;
    root.scrollTo({ top: i * root.clientHeight, behavior: "smooth" });
  }, []);

  // الأسهم ولوحة المفاتيح للشاشات الكبيرة.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        go(active + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        go(active - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go]);

  /** نقرة (لا سحب) على الطبقة: نفتح المشغّل للمس ثوانيَ قليلة ليُشغَّل/يُوقَف. */
  const tapStart = useRef<{ x: number; y: number; t: number } | null>(null);
  function onDown(e: React.PointerEvent) {
    tapStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function onUp(e: React.PointerEvent, i: number) {
    const s = tapStart.current;
    tapStart.current = null;
    if (!s || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10 || Date.now() - s.t > 400) return;
    setTouchable(i);
    if (touchTimer.current) clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setTouchable(-1), 4000);
  }

  if (!ready) return <div className="shorts-empty" role="status" aria-busy="true" aria-label="جارٍ التحميل"><div className="skel skel-short" /></div>;
  if (slides.length === 0) return <p className="empty-note shorts-empty">لا توجد مقاطع قصيرة بعد.</p>;

  return (
    <>
      <h1 className="sr-only">مقاطع قصيرة</h1>
      <div className="shorts-wrap">
      <div className="shorts-feed" ref={feedRef} aria-label="المقاطع القصيرة، مرّر لأعلى أو لأسفل للتنقل بين المقاطع">
        {slides.map((s, i) => {
          const v = s.video;
          const near = Math.abs(i - active) <= 1;
          return (
            <section key={s.key} className="short-slide" data-i={i} aria-label={v.title}>
              <div className="short-frame">
                {i === active ? (
                  <iframe
                    src={`https://drive.google.com/file/d/${v.driveId}/preview?autoplay=1`}
                    title={`مشغّل الفيديو — ${v.title}`}
                    allow="autoplay; fullscreen"
                    referrerPolicy="no-referrer"
                    onLoad={() => setLoadedKey(s.key)}
                  />
                ) : (
                  near &&
                  v.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail} alt="" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                  )
                )}
                {i === active && <PlayLoader show={loadedKey !== s.key} />}
                {i === active && touchable !== i && (
                  <div className="short-swipe" onPointerDown={onDown} onPointerUp={(e) => onUp(e, i)} />
                )}
                <div className="short-info">
                  <h2>{v.title}</h2>
                  {(v.categoryName || v.seriesName) && <small>{[v.categoryName, v.seriesName].filter(Boolean).join(" • ")}</small>}
                  <small className="short-views">{viewsAndAge(v.views, v.createdAt)}</small>
                </div>
                {i === active && (
                  <Link href={`/v/${v.id}`} className="short-open">فتح صفحة الفيديو</Link>
                )}
              </div>
            </section>
          );
        })}
      </div>
        <div className="short-nav">
          <button type="button" aria-label="المقطع السابق" title="السابق" disabled={active === 0} onClick={() => go(active - 1)}>
            <Icon name="up" size={22} />
          </button>
          <button type="button" aria-label="المقطع التالي" title="التالي" disabled={active >= slides.length - 1} onClick={() => go(active + 1)}>
            <Icon name="chevdown" size={22} />
          </button>
        </div>
      </div>
    </>
  );
}
