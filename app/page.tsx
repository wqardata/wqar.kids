import Link from "next/link";
import { episodes } from "@/lib/data";

export default function Home() {
  return (
    <ul className="grid">
      {episodes.map((e, i) => (
        <li key={e.id}>
          <Link href={`/watch/${e.id}`} className="card">
            <div className="thumb" style={{ ["--h" as string]: (i * 47) % 360 }}>
              <span className="dur">{e.duration}</span>
            </div>
            <h3>{e.title}</h3>
            <p>{e.series} • م{e.season} • ح{e.episode}</p>
            <p className="meta">{e.views} مشاهدة • {e.when}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
