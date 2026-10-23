import AddedVideos from "@/components/AddedVideos";
import EpisodeCard from "@/components/EpisodeCard";
import { episodes } from "@/lib/data";

export default function Home() {
  return (
    <>
      <h1 className="sr-only">أحدث الفيديوهات</h1>
      <AddedVideos emptyNote="لا توجد فيديوهات بعد." />
      {episodes.length > 0 && (
        <ul className="grid">
          {episodes.map((e, i) => (
            <li key={e.id}>
              <EpisodeCard episode={e} index={i} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
