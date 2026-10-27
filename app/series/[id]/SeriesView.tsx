"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import VideoGrid from "@/components/VideoGrid";
import { SkeletonGrid } from "@/components/Skeleton";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { shuffled } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { USE_NEON } from "@/lib/backend";
import { neonNamedOne, neonVideosBySeries } from "@/lib/neonClient";
import { toVideo, type VideoDoc } from "@/lib/videos";

export default function SeriesView({ id }: { id: string }) {
  const [name, setName] = useState("");
  const [raw, setRaw] = useState<VideoDoc[]>([]);
  const { settings } = useSettings();
  const order = settings.display.groupOrder;
  const [state, setState] = useState<"loading" | "ok" | "missing">(isFirebaseConfigured ? "loading" : "missing");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    const load: Promise<{ name: string; videos: VideoDoc[] } | null> = USE_NEON
      ? Promise.all([neonNamedOne("series", id), neonVideosBySeries(id)]).then(([s, videos]) => (s ? { name: s.name, videos } : null))
      : Promise.all([getDoc(doc(getDb(), "series", id)), getDocs(query(collection(getDb(), "videos"), where("seriesId", "==", id)))]).then(([s, snap]) =>
          s.exists() ? { name: String(s.data().name ?? ""), videos: snap.docs.map((d) => toVideo(d.id, d.data())) } : null,
        );
    load
      .then((r) => {
        if (off) return;
        if (!r) return setState("missing");
        document.title = r.name;
        setName(r.name);
        setRaw(r.videos.filter((v) => !v.hidden));
        setState("ok");
      })
      .catch(() => !off && setState("missing"));
    return () => {
      off = true;
    };
  }, [id]);

  // الترتيب من «إعدادات العرض»؛ العشوائي يُخلط مرة لكل تحميل أو عند تغيير الخيار.
  const items = useMemo(() => {
    if (order === "random") return shuffled(raw);
    const dir = order === "oldest" ? 1 : -1;
    return [...raw].sort((a, b) => dir * ((a.createdAt ?? 0) - (b.createdAt ?? 0)));
  }, [raw, order]);

  if (state === "loading") return <SkeletonGrid />;
  if (state === "missing") return <p className="empty-note">لم يُعثر على هذه المجموعة.</p>;
  return (
    <>
      <h1 className="page-title">{name}</h1>
      {items.length ? <VideoGrid items={items} /> : <p className="empty-note">لا توجد حلقات في هذه المجموعة بعد.</p>}
    </>
  );
}
