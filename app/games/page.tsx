import type { Metadata } from "next";
import { GAMES } from "@/lib/data";

export const metadata: Metadata = { title: "ألعاب" };

export default function Games() {
  if (GAMES.length === 0) {
    return (
      <div className="empty">
        <h1>ألعاب</h1>
        <p>لا توجد ألعاب حاليًا، وسنضيفها قريبًا.</p>
      </div>
    );
  }
  return (
    <>
      <h1 className="page-title">ألعاب</h1>
      <ul className="groups">
        {GAMES.map((g) => (
          <li key={g.href}>
            <a className="group" href={g.href} target="_blank" rel="noopener noreferrer">
              <span>
                <strong>{g.title}</strong>
                <small>{g.description}</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
