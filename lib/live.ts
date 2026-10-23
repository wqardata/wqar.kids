// البث المباشر المبني من فيديوهات القناة: قائمة مرتّبة تُعرض بتسلسل زمني مشترك بين كل المشاهدين.
// تُحفظ في Firestore: live/current

export type LiveItem = {
  videoId: string;
  title: string;
  driveId: string;
  thumbnail: string;
  /** بالثواني؛ 0 = غير معروفة. */
  duration: number;
};

export type LiveDoc = {
  title: string;
  items: LiveItem[];
  loop: boolean;
  active: boolean;
  /** لحظة بدء البث (ms) أو null. */
  startedAt: number | null;
};

export const EMPTY_LIVE: LiveDoc = { title: "", items: [], loop: true, active: false, startedAt: null };
export const LIVE_MAX_ITEMS = 100;

export function parseLive(d: Record<string, unknown> | undefined): LiveDoc {
  if (!d) return EMPTY_LIVE;
  const items = Array.isArray(d.items)
    ? (d.items as unknown[])
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
          const dur = Number(o.duration);
          return {
            videoId: s("videoId"),
            title: s("title"),
            driveId: s("driveId"),
            thumbnail: s("thumbnail"),
            duration: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 0,
          };
        })
        .filter((i) => i.videoId && i.driveId)
        .slice(0, LIVE_MAX_ITEMS)
    : [];
  const t = d.startedAt as { toMillis?: () => number } | null | undefined;
  return {
    title: typeof d.title === "string" ? d.title : "",
    items,
    loop: d.loop !== false,
    active: d.active === true,
    startedAt: t && typeof t.toMillis === "function" ? t.toMillis() : null,
  };
}

export function totalSeconds(items: readonly LiveItem[]): number {
  return items.reduce((n, i) => n + i.duration, 0);
}

export type NowPlaying =
  | { state: "playing"; index: number; offset: number; remaining: number }
  | { state: "ended" }
  | { state: "invalid" };

/** أي عنصر يُعرض الآن وكم مضى منه؟ (كل المشاهدين يحصلون على النتيجة نفسها لأنها تعتمد على وقت البدء). */
export function nowPlaying(items: readonly LiveItem[], startedAt: number, now: number, loop: boolean): NowPlaying {
  const total = totalSeconds(items);
  if (items.length === 0 || total <= 0 || items.some((i) => i.duration <= 0)) return { state: "invalid" };
  let t = Math.max(0, (now - startedAt) / 1000);
  if (t >= total) {
    if (!loop) return { state: "ended" };
    t = t % total;
  }
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    if (t < acc + items[i].duration) return { state: "playing", index: i, offset: t - acc, remaining: acc + items[i].duration - t };
    acc += items[i].duration;
  }
  return { state: "ended" };
}

/** ثوانٍ → «h:mm:ss» دائمًا (للإجمالي). */
export function formatTotal(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${r}`;
}
