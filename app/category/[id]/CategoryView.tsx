"use client";
import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { SkeletonGrid } from "@/components/Skeleton";
import VideoGrid from "@/components/VideoGrid";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { USE_NEON } from "@/lib/backend";
import { neonNamedOne, neonVideosByCategory } from "@/lib/neonClient";
import { toVideo, type VideoDoc } from "@/lib/videos";

/** فيديوهات تصنيف واحد، الأحدث أولًا. */
export default function CategoryView({ id }: { id: string }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<VideoDoc[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "missing">(isFirebaseConfigured ? "loading" : "missing");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let off = false;
    const load: Promise<{ name: string; videos: VideoDoc[] } | null> = USE_NEON
      ? Promise.all([neonNamedOne("categories", id), neonVideosByCategory(id)]).then(([c, videos]) => (c ? { name: c.name, videos } : null))
      : Promise.all([getDoc(doc(getDb(), "categories", id)), getDocs(query(collection(getDb(), "videos"), where("categoryId", "==", id)))]).then(([c, snap]) =>
          c.exists() ? { name: String(c.data().name ?? ""), videos: snap.docs.map((d) => toVideo(d.id, d.data())) } : null,
        );
    load
      .then((r) => {
        if (off) return;
        if (!r) return setState("missing");
        document.title = r.name;
        setName(r.name);
        setItems(r.videos.filter((v) => !v.hidden).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)));
        setState("ok");
      })
      .catch(() => !off && setState("missing"));
    return () => {
      off = true;
    };
  }, [id]);

  if (state === "loading") return <SkeletonGrid />;
  if (state === "missing") return <p className="empty-note">لم يُعثر على هذا التصنيف.</p>;
  return (
    <>
      <h1 className="page-title">{name}</h1>
      {items.length ? <VideoGrid items={items} /> : <p className="empty-note">لا توجد فيديوهات في هذا التصنيف بعد.</p>}
    </>
  );
}
