import type { Metadata } from "next";
import SeriesView from "./SeriesView";
import { seriesMetadata } from "@/lib/shareMeta";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return seriesMetadata(id);
}

export default async function Series({ params }: Props) {
  const { id } = await params;
  return <SeriesView id={id} />;
}
