import type { Metadata } from "next";
import SearchResults from "@/components/SearchResults";

export const metadata: Metadata = { title: "بحث", robots: { index: false } };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100) ?? "";

  return (
    <>
      <h1 className="page-title">{q ? `نتائج البحث عن «${q}»` : "البحث"}</h1>
      {q ? <SearchResults q={q} /> : <p className="empty-note">اكتب اسم مجموعة أو فيديو في شريط البحث بالأعلى.</p>}
    </>
  );
}
