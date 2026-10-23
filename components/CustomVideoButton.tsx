"use client";
import Icon from "@/components/Icon";
import { buildButtonUrl, type VideoButton } from "@/lib/videoPage";

/** زر رابط مخصّص أضافه المشرف في صفحة الفيديو. */
export default function CustomVideoButton({ b, video }: { b: VideoButton; video: { id: string; title: string; driveId: string } }) {
  const href = buildButtonUrl(b.url, video, typeof window === "undefined" ? "" : window.location.href);
  if (!href) return null;
  return (
    <a
      href={href}
      className={`ibtn${b.showLabel ? " ibtn--text" : ""}`}
      aria-label={b.label}
      title={b.label}
      {...(b.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <Icon name={b.icon} size={20} />
      {b.showLabel && <span>{b.label}</span>}
    </a>
  );
}
