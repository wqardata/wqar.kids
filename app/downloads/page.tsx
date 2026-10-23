import type { Metadata } from "next";
import { episodes } from "@/lib/data";

export const metadata: Metadata = { title: "التنزيلات" };

const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

export default function Downloads() {
  const items = episodes.filter((e) => e.driveId && DRIVE_ID.test(e.driveId));
  return (
    <>
      <h1 className="page-title">التنزيلات</h1>
      {items.length === 0 ? (
        <p className="empty-note">لا توجد حلقات متاحة للتنزيل بعد.</p>
      ) : (
        <ul className="groups">
          {items.map((e) => (
            <li key={e.id} className="group group--row">
              <span>
                <strong>{e.title}</strong>
                <small>{e.series} • {e.duration}</small>
              </span>
              <a
                className="btn btn--sm"
                href={`https://drive.google.com/uc?export=download&id=${e.driveId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                تنزيل
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
