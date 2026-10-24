"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import ClipPlayer from "@/components/ClipPlayer";
import Icon from "@/components/Icon";
import DrivePlayer from "@/components/DrivePlayer";
import SuggestedVideos from "@/components/SuggestedVideos";
import { SkeletonWatch } from "@/components/Skeleton";
import WatchActions from "@/components/WatchActions";
import { useAuth } from "@/lib/auth";
import { autoDetectSkip } from "@/lib/autoSkip";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { recordView } from "@/lib/history";
import { useSettings } from "@/lib/settings";
import { countView, toVideo, type VideoDoc } from "@/lib/videos";

const VideoEditPanel = dynamic(() => import("./VideoEditPanel"), { ssr: false });

const tried = (id: string) => `autoskip:${id}`;

/** مدة الإعلان والمقدمة للمشغّل: غير محدّدة = الافتراضي، وفُحص بلا نتيجة = بلا زر. */
function skipProps(v: VideoDoc): { adSec?: number; introSec?: number } {
  if (v.adSec === null && v.introSec === null) return v.skipChecked ? { adSec: 0, introSec: 0 } : {};
  return { adSec: v.adSec ?? 0, introSec: v.introSec ?? 0 };
}

export default function VideoView({ id }: { id: string }) {
  const { loading: authLoading, canAdd, user } = useAuth();
  const { settings } = useSettings();
  const [video, setVideo] = useState<VideoDoc | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">(isFirebaseConfigured ? "loading" : "missing");
  const [editing, setEditing] = useState(false);
  const [autoMsg, setAutoMsg] = useState(""); // حالة الكشف التلقائي (للمشرف فقط)

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    getDoc(doc(getDb(), "videos", id))
      .then((snap) => {
        if (off) return;
        if (snap.exists()) {
          const v = toVideo(snap.id, snap.data());
          document.title = v.title;
          if (!v.hidden) {
            recordView(v.id); // سجل المشاهدة (محلي)
            void countView(v.id); // عدّاد المشاهدات العام (مرة لكل جلسة)
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

  // كشف تلقائي لمدة الإعلان والمقدمة: مرة لكل فيديو، عند فتحه من مشرف (يحتاج مقارنته بفيديوهات أخرى).
  // النتيجة تُحفظ في الفيديو فيراها كل الزوار على زر «تخطي».
  const needAuto = canAdd && !!user && !!video && !!video.driveId && !video.clip && !video.skipChecked && video.adSec === null && video.introSec === null;
  const vid = video?.id ?? "";
  useEffect(() => {
    if (!needAuto || !user || !video) return;
    try {
      if (sessionStorage.getItem(tried(vid))) return;
      sessionStorage.setItem(tried(vid), "1");
    } catch {
      /* التخزين غير متاح: نكمل */
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setAutoMsg("جارٍ كشف المقدمة والإعلان تلقائيًا…");
      const r = await autoDetectSkip(video, user, { signal: ctl.signal, onStep: (t) => !ctl.signal.aborted && setAutoMsg(t) });
      if (ctl.signal.aborted) return;
      if (r.status !== "ok") {
        setAutoMsg(r.status === "no-refs" ? "" : r.message);
        return;
      }
      const patch = { adSec: r.adSec, introSec: r.introSec, skipTo: r.adSec || r.introSec ? (r.adSec ?? 0) + (r.introSec ?? 0) : null, skipChecked: true };
      try {
        await updateDoc(doc(getDb(), "videos", vid), { ...patch, updatedAt: serverTimestamp() });
        setVideo((v) => (v && v.id === vid ? { ...v, ...patch } : v));
        setAutoMsg(r.adSec || r.introSec ? `تم كشف ${r.adSec ? `الإعلان (${r.adSec} ث)` : ""}${r.adSec && r.introSec ? " و" : ""}${r.introSec ? `المقدمة (${r.introSec} ث)` : ""} وربطها بزر التخطي ✓` : "لم يُعثر على إعلان أو مقدمة مشتركة في هذا الفيديو.");
      } catch {
        setAutoMsg("تم الكشف لكن تعذّر حفظ النتيجة. تأكد من قواعد Firestore.");
      }
    }, 3000);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
    // video يتغيّر بعد الحفظ؛ نريد التشغيل مرة لكل فيديو فقط.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needAuto, vid, user]);

  if (state === "loading" || (video?.hidden && authLoading)) return <SkeletonWatch />;
  if (state === "missing" || !video || (video.hidden && !canAdd)) return <p className="empty-note">لم يُعثر على هذا الفيديو.</p>;

  const parts = [video.categoryName, video.seriesName && `${video.seriesName}${video.season ? ` • م${video.season}` : ""}${video.episode ? ` • ح${video.episode}` : ""}`].filter(Boolean);

  return (
    <div className="watch">
      <article>
        {video.clip ? (
          <div className="clip-watch">
            <div className="clip-box"><ClipPlayer driveId={video.driveId} title={video.title} clip={video.clip} active={settings.autoplay} /></div>
          </div>
        ) : (
          <DrivePlayer driveId={video.driveId} title={video.title} hue={160} autoplay={settings.autoplay} {...skipProps(video)} />
        )}
        {video.hidden && <p className="meta">⚠ هذا الفيديو مخفي عن الزوار (تراه لأنك مشرف).</p>}
        <h1>{video.title}</h1>
        {parts.length > 0 && <p className="meta">{parts.join(" • ")}</p>}
        {video.description && <p className="desc">{video.description}</p>}
        <WatchActions video={video} />
        {canAdd && (
          <div className="watch-admin">
            {autoMsg && <p className="hint" role="status">{autoMsg}</p>}
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
