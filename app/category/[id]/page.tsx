import type { Metadata } from "next";
import CategoryView from "./CategoryView";

export const metadata: Metadata = { title: "تصنيف" };

export default async function Category({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CategoryView id={id} />;
}
