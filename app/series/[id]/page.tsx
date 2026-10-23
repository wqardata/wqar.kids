import type { Metadata } from "next";
import SeriesView from "./SeriesView";

export const metadata: Metadata = { title: "مجموعة" };

export default async function Series({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SeriesView id={id} />;
}
