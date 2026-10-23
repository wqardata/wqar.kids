import EpisodeCard from "@/components/EpisodeCard";
import AddedVideos from "@/components/AddedVideos";
import { episodes } from "@/lib/data";

export default function Home() {
  return (
    <>
      <h1 className="sr-only">أحدث الحلقات</h1>
      <AddedVideos />
      <ul className="grid">
        {episodes.map((e, i) => (
          <li key={e.id}>
            <EpisodeCard episode={e} index={i} />
          </li>
        ))}
      </ul>
    </>
  );
}
