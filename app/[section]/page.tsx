import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { nav, more } from "@/lib/data";

const all = [...nav, ...more].filter((n) => n.href !== "/");

// أي مسار غير مُعرَّف هنا يعطي 404 ثابتًا.
export const dynamicParams = false;

export function generateStaticParams() {
  return all.map((n) => ({ section: n.href.slice(1) }));
}

type Props = { params: Promise<{ section: string }> };

function find(section: string) {
  return all.find((n) => n.href === `/${section}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const item = find(section);
  return { title: item?.label };
}

export default async function Section({ params }: Props) {
  const { section } = await params;
  const item = find(section);
  if (!item) notFound();
  return (
    <div className="empty">
      <h1>{item.label}</h1>
      <p>هذا القسم قيد البناء، وسيُضاف في الخطوات القادمة.</p>
    </div>
  );
}
