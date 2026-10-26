"use client";
import { DRIVE_ID } from "@/lib/drive";
import { SkeletonRows } from "@/components/Skeleton";
import { useAllVideos } from "@/lib/videos";

export default function DownloadsList() {
  const { videos, ready } = useAllVideos();
  if (!ready) return <SkeletonRows />;
  const items = videos.filter((v) => DRIVE_ID.test(v.driveId));
  if (items.length === 0) return <p className="empty-note">لا توجد فيديوهات متاحة للتنزيل بعد.</p>;
  return (
    <ul className="groups">
      {items.map((v) => (
        <li key={v.id} className="group group--row">
          <span>
            <strong>{v.title}</strong>
            {v.seriesName && <small>{v.seriesName}</small>}
          </span>
          <a className="btn btn--sm" href={`https://drive.google.com/uc?export=download&id=${v.driveId}`} target="_blank" rel="noopener noreferrer">
            تنزيل
          </a>
        </li>
      ))}
    </ul>
  );
}
