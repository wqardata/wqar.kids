import EpisodeCard from "@/components/EpisodeCard";
import { episodes, type Episode } from "@/lib/data";

export default function EpisodeGrid({ items }: { items: readonly Episode[] }) {
  return (
    <ul className="grid">
      {items.map((e) => (
        <li key={e.id}>
          <EpisodeCard episode={e} index={episodes.indexOf(e)} />
        </li>
      ))}
    </ul>
  );
}
