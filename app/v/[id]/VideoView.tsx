"use client";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import DrivePlayer from "@/components/DrivePlayer";
import FavoriteButton from "@/components/FavoriteButton";
import SuggestedVideos from "@/components/SuggestedVideos";
import { useAuth } from "@/lib/auth";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { toVideo, type VideoDoc } from "@/lib/videos";

export default function VideoView({ id }: { id: string }) {
  const { loading: authLoading, canAdd } = useAuth();
  const [video, setVideo] = useState<VideoDoc | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">(isFirebaseConfigured ? "loading" : "missing");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDoc(doc(getDb(), "videos", id))
      .then((snap) => {
        if (off) return;
        if (snap.exists()) {
          const v = toVideo(snap.id, snap.data());
          document.title = v.title;
          setVideo(v);
          setState("ok");
        } else setState("missing");
      })
      .catch(() => !off && setState("missing"));
    return () => {
      off = true;
    };
  }, [id]);

  if (state === "loading" || (video?.hidden && authLoading)) return <p className="empty-note" role="status">جارٍ التحميل…</p>;
  if (state === "missing" || !video || (video.hidden && !canAdd)) return <p className="empty-note">لم يُعثر على هذا الفيديو.</p>;

  const parts = [video.categoryName, video.seriesName && `${video.seriesName}${video.season ? ` • م${video.season}` : ""}${video.episode ? ` • ح${video.episode}` : ""}`].filter(Boolean);

  return (
    <div className="watch">
      <article>
        <DrivePlayer driveId={video.driveId} title={video.title} hue={160} />
        {video.hidden && <p className="meta">⚠ هذا الفيديو مخفي عن الزوار (تراه لأنك مشرف).</p>}
        <h1>{video.title}</h1>
        {parts.length > 0 && <p className="meta">{parts.join(" • ")}</p>}
        {video.description && <p className="desc">{video.description}</p>}
        <div className="actions"><FavoriteButton id={video.id} /></div>
      </article>
      <SuggestedVideos current={video} />
    </div>
  );
}
