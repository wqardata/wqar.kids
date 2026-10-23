import type { Metadata } from "next";
import EpisodeCard from "@/components/EpisodeCard";
import { episodes, searchEpisodes } from "@/lib/data";

export const metadata: Metadata = { title: "بحث", robots: { index: false } };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100) ?? "";
  const results = q ? searchEpisodes(q) : [];

  return (
    <>
      <h1 className="page-title">{q ? `نتائج البحث عن «${q}»` : "البحث"}</h1>
      {!q ? (
        <p className="empty-note">اكتب اسم مسلسل أو حلقة في شريط البحث بالأعلى.</p>
      ) : results.length === 0 ? (
        <p className="empty-note">لا توجد نتائج مطابقة. جرّب كلمة أقصر أو اسم المسلسل.</p>
      ) : (
        <ul className="grid">
          {results.map((e) => (
            <li key={e.id}>
              <EpisodeCard episode={e} index={episodes.indexOf(e)} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
