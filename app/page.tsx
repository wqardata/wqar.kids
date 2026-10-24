import EpisodeCard from "@/components/EpisodeCard";
import HomeFeed from "@/components/HomeFeed";
import Splash from "@/components/Splash";
import { episodes } from "@/lib/data";

export default function Home() {
  return (
    <>
      <Splash />
      <h1 className="sr-only">الفيديوهات</h1>
      <HomeFeed emptyNote="لا توجد فيديوهات بعد." />
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
