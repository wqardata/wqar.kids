import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { SERIES_LIST, seriesEpisodes } from "@/lib/data";

export const metadata: Metadata = { title: "مجموعاتي" };

export default function Subscriptions() {
  return (
    <>
      <h1 className="page-title">مجموعاتي</h1>
      <ul className="groups">
        {SERIES_LIST.map((s, i) => (
          <li key={s.id}>
            <Link href={`/series/${s.id}`} className="group">
              <span className="avatar" style={{ "--h": (i * 47) % 360 } as CSSProperties} aria-hidden="true">
                {s.name[0]}
              </span>
              <span>
                <strong>{s.name}</strong>
                <small>{seriesEpisodes(s.name).length} حلقة</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
