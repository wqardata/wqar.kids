// تحويل صفوف Neon إلى الأشكال التي تستعملها الواجهة (VideoDoc / Named). دوال خالصة بلا شبكة ولا قاعدة بيانات.
import { cleanCoverImage } from "./coverUrl";
import type { Named, VideoDoc } from "./videos";

export type VideoRow = {
  id: string;
  title: string | null;
  drive_id: string | null;
  youtube_id: string | null;
  thumbnail: string | null;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  series_id: string | null;
  series_name: string | null;
  season: number | null;
  episode: number | null;
  is_short: boolean | null;
  hidden: boolean | null;
  duration: number | null;
  clip: boolean | null;
  series_order: number | null;
  views: number | null;
  likes: number | null;
  created_at: Date | string | null;
};

export type NamedRow = {
  id: string;
  name: string | null;
  cover_video_id: string | null;
  cover_image: string | null;
  avatar_url: string | null;
};

const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

function millis(v: Date | string | null | undefined): number | null {
  const t = v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
}

/** مطابق لـ toVideo في lib/videos.ts (المقطع القديم clip يُعامل كمخفي). */
export function rowToVideo(r: VideoRow): VideoDoc {
  const yt = s(r.youtube_id);
  const clip = r.clip === true;
  return {
    id: r.id,
    title: s(r.title),
    driveId: s(r.drive_id),
    youtubeId: /^[A-Za-z0-9_-]{11}$/.test(yt) ? yt : "",
    thumbnail: s(r.thumbnail),
    description: s(r.description),
    categoryId: s(r.category_id),
    categoryName: s(r.category_name),
    seriesId: s(r.series_id),
    seriesName: s(r.series_name),
    season: n(r.season),
    episode: n(r.episode),
    isShort: r.is_short === true,
    hidden: r.hidden === true || clip,
    duration: typeof r.duration === "number" && r.duration > 0 ? Math.round(r.duration) : null,
    clip,
    seriesOrder: n(r.series_order),
    views: count(r.views),
    likes: count(r.likes),
    createdAt: millis(r.created_at),
  };
}

/** الشكل الذي ترجعه مسارات /api/data/named (avatarUrl فارغ = لم يُحسب بعد، فيحسبه المتصفح من فيديوهات المجموعة). */
export type NamedOut = Named & { avatarUrl: string };

export function rowToNamed(r: NamedRow): NamedOut {
  return {
    id: r.id,
    name: s(r.name),
    coverVideoId: s(r.cover_video_id),
    coverImage: cleanCoverImage(r.cover_image),
    avatarUrl: s(r.avatar_url),
  };
}
