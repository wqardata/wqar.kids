"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

/** زر مشاركة: نافذة المشاركة في الجوال إن وُجدت، وإلا ينسخ رابط الفيديو. */
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ألغى المستخدم المشاركة أو لم يُسمح بالنسخ */
    }
  }

  const label = copied ? "تم نسخ الرابط" : "مشاركة";
  return (
    <button type="button" className={`ibtn${copied ? " on" : ""}`} aria-label={label} title={label} onClick={() => void share()}>
      <Icon name={copied ? "check" : "share"} size={20} />
      {copied && <span role="status">تم النسخ</span>}
    </button>
  );
}
