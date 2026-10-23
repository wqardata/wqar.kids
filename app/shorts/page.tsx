import type { Metadata } from "next";
import EpisodeGrid from "@/components/EpisodeGrid";
import { episodes, isShort } from "@/lib/data";

export const metadata: Metadata = { title: "قصيرة" };

export default function Shorts() {
  const items = episodes.filter(isShort);
  return (
    <>
      <h1 className="page-title">حلقات قصيرة</h1>
      {items.length ? <EpisodeGrid items={items} /> : <p className="empty-note">لا توجد حلقات قصيرة بعد.</p>}
    </>
  );
}
