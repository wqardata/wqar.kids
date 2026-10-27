import type { Metadata } from "next";
import CategoryView from "./CategoryView";
import { categoryMetadata } from "@/lib/shareMeta";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return categoryMetadata(id);
}

export default async function Category({ params }: Props) {
  const { id } = await params;
  return <CategoryView id={id} />;
}
