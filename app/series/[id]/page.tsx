import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EpisodeGrid from "@/components/EpisodeGrid";
import { SERIES_LIST, seriesEpisodes } from "@/lib/data";

export const dynamicParams = false;
export function generateStaticParams() {
  return SERIES_LIST.map((s) => ({ id: s.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: SERIES_LIST.find((s) => s.id === id)?.name };
}

export default async function Series({ params }: Props) {
  const { id } = await params;
  const s = SERIES_LIST.find((x) => x.id === id);
  if (!s) notFound();
  return (
    <>
      <h1 className="page-title">{s.name}</h1>
      <EpisodeGrid items={seriesEpisodes(s.name)} />
    </>
  );
}
