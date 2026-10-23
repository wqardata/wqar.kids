import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import EpisodeCard from "@/components/EpisodeCard";
import Icon from "@/components/Icon";
import { episodes, getEpisode, relatedEpisodes } from "@/lib/data";
import { viewsLabel } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return episodes.map((e) => ({ id: e.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ep = getEpisode(id);
  return ep ? { title: ep.title, description: ep.description } : {};
}

export default async function Watch({ params }: Props) {
  const { id } = await params;
  const ep = getEpisode(id);
  if (!ep) notFound();
  const related = relatedEpisodes(ep);
  const hue = (episodes.indexOf(ep) * 47) % 360;

  return (
    <div className="watch">
      <article>
        <div
          className="player"
          role="img"
          aria-label={`مشغّل الفيديو — ${ep.title} (قيد البناء)`}
          style={{ "--h": hue } as CSSProperties}
        >
          <span className="play"><Icon name="play" size={34} /></span>
        </div>
        <h1>{ep.title}</h1>
        <p className="meta">
          {ep.series} • م{ep.season} • ح{ep.episode} • {ep.duration}
        </p>
        <p className="meta">
          {viewsLabel(ep.views)} • {ep.when}
        </p>
        <p className="desc">{ep.description}</p>
      </article>

      <section aria-labelledby="related-title">
        <h2 id="related-title">حلقات مقترحة</h2>
        <ul className="grid grid--side">
          {related.map((e) => (
            <li key={e.id}>
              <EpisodeCard episode={e} index={episodes.indexOf(e)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
