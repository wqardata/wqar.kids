"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

/** مشاركة رابط الفيديو: قائمة المشاركة في الجهاز إن وُجدت، وإلا نسخ الرابط. */
export default function ShareButton({ title, showLabel = false }: { title: string; showLabel?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return; // ألغى المستخدم
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("انسخ الرابط:", url);
    }
  }

  const label = copied ? "تم نسخ الرابط ✓" : "مشاركة";
  return (
    <button type="button" className={`ibtn${showLabel || copied ? " ibtn--text" : ""}${copied ? " on" : ""}`} aria-label="مشاركة الفيديو" title="مشاركة الفيديو" onClick={() => void share()}>
      <Icon name={copied ? "check" : "share"} size={20} />
      {(showLabel || copied) && <span>{label}</span>}
    </button>
  );
}
