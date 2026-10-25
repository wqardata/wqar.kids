"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import VideoGrid from "@/components/VideoGrid";
import { SkeletonGrid } from "@/components/Skeleton";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { shuffled } from "@/lib/format";
import { useSettings } from "@/lib/settings";
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
    Promise.all([getDoc(doc(getDb(), "series", id)), getDocs(query(collection(getDb(), "videos"), where("seriesId", "==", id)))])
      .then(([s, snap]) => {
        if (off) return;
        if (!s.exists()) return setState("missing");
        const n = String(s.data().name ?? "");
        document.title = n;
        setName(n);
        setRaw(snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => !v.hidden));
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
