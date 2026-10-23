import type { Metadata } from "next";
import EpisodeGrid from "@/components/EpisodeGrid";
import { episodes } from "@/lib/data";

export const metadata: Metadata = { title: "الجديد" };

export default function New() {
  // البيانات مرتبة من الأحدث؛ نعرض حلقات «أمس» أولًا ثم الباقي.
  const items = [...episodes].sort((a, b) => Number(b.when === "أمس") - Number(a.when === "أمس"));
  return (
    <>
      <h1 className="page-title">الجديد</h1>
      <EpisodeGrid items={items} />
    </>
  );
}
