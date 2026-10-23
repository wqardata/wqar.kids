import Link from "next/link";
import type { CSSProperties } from "react";
import type { Episode } from "@/lib/data";
import { viewsLabel } from "@/lib/format";

export default function EpisodeCard({ episode: e, index }: { episode: Episode; index: number }) {
  const hue = (index * 47) % 360;
  return (
    <Link href={`/watch/${e.id}`} className="card">
      <div className="thumb" style={{ "--h": hue } as CSSProperties}>
        <span className="dur">{e.duration}</span>
      </div>
      <h3>{e.title}</h3>
      <p>
        {e.series} • م{e.season} • ح{e.episode}
      </p>
      <p className="meta">
        {viewsLabel(e.views)} • {e.when}
      </p>
    </Link>
  );
}
