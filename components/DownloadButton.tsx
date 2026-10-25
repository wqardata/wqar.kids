"use client";
import Icon from "@/components/Icon";
import { DRIVE_ID } from "@/lib/drive";

/** زر تنزيل: يفتح رابط التنزيل المباشر من درايف (يبدأ التنزيل تلقائيًا). */
export default function DownloadButton({ driveId, title }: { driveId: string; title: string }) {
  if (!driveId || !DRIVE_ID.test(driveId)) return null;
  return (
    <a
      className="ibtn"
      href={`https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`تنزيل الفيديو — ${title}`}
      title="تنزيل"
    >
      <Icon name="down" size={20} />
    </a>
  );
}
