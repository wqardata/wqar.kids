import type { Metadata } from "next";
import AddedVideos from "@/components/AddedVideos";
import EpisodeGrid from "@/components/EpisodeGrid";
import { episodes, isShort } from "@/lib/data";

export const metadata: Metadata = { title: "قصيرة" };

export default function Shorts() {
  const items = episodes.filter(isShort);
  return (
    <>
      <h1 className="page-title">مقاطع قصيرة</h1>
      <AddedVideos mode="shorts" emptyNote={items.length ? undefined : "لا توجد مقاطع قصيرة بعد."} />
      {items.length > 0 && <EpisodeGrid items={items} />}
    </>
  );
}
