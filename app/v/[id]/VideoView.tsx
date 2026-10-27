"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import Icon from "@/components/Icon";
import DrivePlayer from "@/components/DrivePlayer";
import YouTubePlayer from "@/components/YouTubePlayer";
import SeriesAvatar from "@/components/SeriesAvatar";
import SuggestedVideos, { episodeLabel } from "@/components/SuggestedVideos";
import { SkeletonWatch } from "@/components/Skeleton";
import WatchActions from "@/components/WatchActions";
import { useAuth } from "@/lib/auth";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { addWatched, recordView } from "@/lib/history";
import { viewsAndAge } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { useMiniPlayer } from "@/lib/miniPlayer";
import { USE_NEON } from "@/lib/backend";
import { neonVideo } from "@/lib/neonClient";
import { countView, toVideo, useSeriesAvatars, type VideoDoc } from "@/lib/videos";

const VideoEditPanel = dynamic(() => import("./VideoEditPanel"), { ssr: false });

/** مدة الإعلان والمقدمة للمشغّل: غير محدّدة = الافتراضي، وفُحص بلا نتيجة = بلا زر. */
export default function VideoView({ id }: { id: string }) {
  const { loading: authLoading, canAdd } = useAuth();
  const { settings } = useSettings();
  const avatars = useSeriesAvatars();
  const [video, setVideo] = useState<VideoDoc | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">(isFirebaseConfigured ? "loading" : "missing");
  const [editing, setEditing] = useState(false);
  const [counted, setCounted] = useState(0); // +1 إن سجّلنا مشاهدة هذه الجلسة
  const mp = useMiniPlayer();
  const { open: openMini } = mp;
  // على الجوال/اللوح يُعرض الفيديو في المشغّل المشترك (يتصغّر بالسحب لأسفل ويستمر أثناء تصفح الموقع)؛ على الحاسوب داخل الصفحة.
  // فيديو يوتيوب يُستضاف مثل فيديو درايف تمامًا (المشغّل نفسه يختلف فقط).
  const hosted = mp.narrow && (!!video?.youtubeId || /^[A-Za-z0-9_-]{10,}$/.test(video?.driveId ?? ""));
  useEffect(() => {
    if (hosted && video) openMini({ id: video.id, driveId: video.driveId, youtubeId: video.youtubeId, title: video.title, seriesName: video.seriesName, autoplay: settings.autoplay });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hosted, video?.id, video?.driveId, video?.youtubeId, video?.title, video?.seriesName, openMini]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    const load: Promise<VideoDoc | null> = USE_NEON ? neonVideo(id) : getDoc(doc(getDb(), "videos", id)).then((snap) => (snap.exists() ? toVideo(snap.id, snap.data()) : null));
    load
      .then((v) => {
        if (off) return;
        if (v) {
          document.title = v.title;
          if (!v.hidden) {
            recordView(v.id); // سجل المشاهدة (محلي)
            void countView(v.id).then((ok) => ok && !off && setCounted(1)); // عدّاد المشاهدات العام (مرة لكل جلسة)
          }
          setVideo(v);
          setState("ok");
        } else setState("missing");
      })
      .catch(() => !off && setState("missing"));
    return () => {
      off = true;
    };
  }, [id]);

  // تقدير مدة المشاهدة: الوقت الذي تبقى فيه الصفحة ظاهرة (لا نقرأ وقت التشغيل من مشغّل درايف). يغذّي صف «تابع المشاهدة».
  const vid = video?.id;
  const vdur = video?.duration ?? null;
  const vshort = video?.isShort ?? false;
  useEffect(() => {
    if (!vid || vshort) return;
    let from = document.visibilityState === "visible" ? Date.now() : 0;
    const flush = (restart: boolean) => {
      if (from) addWatched(vid, (Date.now() - from) / 1000, vdur);
      from = restart && document.visibilityState === "visible" ? Date.now() : 0;
    };
    const onVis = () => (document.visibilityState === "visible" ? (from = Date.now()) : flush(false));
    const onHide = () => flush(false);
    const timer = setInterval(() => flush(true), 15_000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      flush(false);
    };
  }, [vid, vdur, vshort]);

  // الكشف التلقائي عن المقدمة والإعلان عُطّل لتوفير الباقة (كان يحمّل أجزاء من عدة فيديوهات عند فتح كل فيديو).
  // الكشف اليدوي ما زال متاحًا من «تعديل الفيديو» ومن ترتيب المجموعة.

  if (state === "loading" || (video?.hidden && authLoading)) return <SkeletonWatch />;
  if (state === "missing" || !video || (video.hidden && !canAdd)) return <p className="empty-note">لم يُعثر على هذا الفيديو.</p>;

  return (
    <div className="watch">
      <article>
        <div className="watch-sticky">
          {hosted ? (
            <>
              <div ref={mp.setSlot} className={video.youtubeId ? "mp-slot mp-slot--yt" : "mp-slot"} />
              <div className="mp-handle-gap" aria-hidden="true" />
            </>
          ) : video.youtubeId ? (
            <YouTubePlayer youtubeId={video.youtubeId} title={video.title} autoplay={settings.autoplay} />
          ) : (
            <DrivePlayer driveId={video.driveId} title={video.title} hue={160} autoplay={settings.autoplay} />
          )}
        </div>
        {video.hidden && <p className="meta">⚠ هذا الفيديو مخفي عن الزوار (تراه لأنك مشرف).</p>}
        {episodeLabel(video) && <p className="watch-se">{episodeLabel(video)}</p>}
        <h1>{video.title}</h1>
        <p className="meta watch-stats">{viewsAndAge(video.views + counted, video.createdAt)}</p>
        {video.description && <p className="desc">{video.description}</p>}
        {video.seriesName && (
          <div className="watch-series">
            <SeriesAvatar name={video.seriesName} url={avatars.get(video.seriesId)} size={44} />
            <div className="watch-series-text">
              {video.seriesId ? <Link href={`/series/${video.seriesId}`} className="tag-link">{video.seriesName}</Link> : <span>{video.seriesName}</span>}
            </div>
          </div>
        )}
        <WatchActions video={video} />
        {canAdd && (
          <div className="watch-admin">
            {editing ? (
              <VideoEditPanel
                video={video}
                onCancel={() => setEditing(false)}
                onSaved={(nv) => {
                  setVideo(nv);
                  document.title = nv.title;
                  setEditing(false);
                }}
              />
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
                <Icon name="edit" size={16} /> تعديل هذا الفيديو
              </button>
            )}
          </div>
        )}
      </article>
      <SuggestedVideos current={video} />
    </div>
  );
}
