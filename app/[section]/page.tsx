import { nav, more } from "@/lib/data";
import { notFound } from "next/navigation";

const all = [...nav, ...more].filter((n) => n.href !== "/");

export function generateStaticParams() {
  return all.map((n) => ({ section: n.href.slice(1) }));
}

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = all.find((n) => n.href === `/${section}`);
  if (!item) notFound();
  return (
    <div className="empty">
      <h1>{item.label}</h1>
      <p>هذا القسم قيد البناء، وسيُضاف في الخطوات القادمة.</p>
    </div>
  );
}
