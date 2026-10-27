"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

/** الفيديو الجاري تشغيله في المشغّل المشترك (يبقى يعمل عند التنقل بين صفحات الموقع على الجوال). */
/** youtubeId غير فارغ = فيديو يوتيوب (يُعرض بمشغّل يوتيوب)، وإلا يُعرض بمشغّل درايف. */
export type Track = { id: string; driveId: string; youtubeId?: string; title: string; seriesName: string; autoplay: boolean };

/** full = المشغّل في موضعه أعلى صفحة الفيديو، mini = شريط مصغّر أسفل الشاشة، none = لا فيديو. */
export type MiniMode = "full" | "mini" | "none";

type Ctx = {
  track: Track | null;
  mode: MiniMode;
  /** الشاشة صغيرة (جوال/لوح): المشغّل المشترك مفعّل، وإلا يُعرض المشغّل داخل الصفحة كالمعتاد. */
  narrow: boolean;
  /** عنصر الفراغ في صفحة الفيديو الذي يُوضع فوقه المشغّل. */
  slotEl: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
  open: (t: Track) => void;
  close: () => void;
  /** يصغّر المشغّل ويعود إلى آخر صفحة كان الزائر فيها خارج الفيديوهات. */
  minimize: () => void;
  /** يعيد فتح صفحة الفيديو الجاري تشغيله. */
  restore: () => void;
};

const MiniCtx = createContext<Ctx | null>(null);

/** نفس نقطة التحوّل التي يتحوّل عندها تخطيط صفحة الفيديو إلى عمود واحد (انظر globals.css). */
const NARROW_QUERY = "(max-width: 1199px)";
/** صفحات لها مشغّلها الخاص: يُغلق المشغّل المصغّر عند دخولها كي لا يتداخل الصوت. */
const OWN_PLAYER = /^\/(shorts|live)(\/|$)/;

function videoIdOf(path: string): string {
  const m = /^\/v\/([^/?#]+)/.exec(path);
  return m ? decodeURIComponent(m[1]) : "";
}

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  const router = useRouter();
  const [track, setTrack] = useState<Track | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);
  const lastOther = useRef("/");

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // الشاشة صارت كبيرة: المشغّل المشترك لا يُستعمل هناك.
  useEffect(() => {
    if (!narrow) setTrack(null);
  }, [narrow]);

  // نتذكّر آخر صفحة خارج الفيديوهات للرجوع إليها عند تصغير المشغّل.
  useEffect(() => {
    if (!videoIdOf(path)) lastOther.current = path + (typeof window !== "undefined" ? window.location.search : "");
    if (OWN_PLAYER.test(path)) setTrack(null);
  }, [path]);

  const open = useCallback((t: Track) => {
    setTrack((p) => (p && p.id === t.id && p.driveId === t.driveId && (p.youtubeId ?? "") === (t.youtubeId ?? "") ? (p.title === t.title && p.seriesName === t.seriesName ? p : { ...p, title: t.title, seriesName: t.seriesName }) : t));
  }, []);
  const close = useCallback(() => setTrack(null), []);
  const minimize = useCallback(() => router.push(lastOther.current || "/"), [router]);
  const restore = useCallback(() => {
    if (track) router.push(`/v/${track.id}`);
  }, [router, track]);

  const mode: MiniMode = !track ? "none" : videoIdOf(path) === track.id && slotEl ? "full" : "mini";

  // يتيح للتنسيق (globals.css) ترك مساحة أسفل الصفحات حين يكون الشريط المصغّر ظاهرًا.
  useEffect(() => {
    document.documentElement.dataset.mp = mode;
    return () => {
      delete document.documentElement.dataset.mp;
    };
  }, [mode]);

  const value = useMemo<Ctx>(() => ({ track, mode, narrow, slotEl, setSlot: setSlotEl, open, close, minimize, restore }), [track, mode, narrow, slotEl, open, close, minimize, restore]);
  return <MiniCtx.Provider value={value}>{children}</MiniCtx.Provider>;
}

const NOOP: Ctx = { track: null, mode: "none", narrow: false, slotEl: null, setSlot: () => {}, open: () => {}, close: () => {}, minimize: () => {}, restore: () => {} };

export function useMiniPlayer(): Ctx {
  return useContext(MiniCtx) ?? NOOP;
}
