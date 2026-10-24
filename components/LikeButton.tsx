"use client";

import Icon from "@/components/Icon";
import { createLocalSet } from "@/lib/localSet";

const likes = createLocalSet("likes");

/** قائمة معرّفات الفيديوهات التي أعجبت الزائر (فارغة على الخادم). */
export const useLikes = likes.useIds;
export const toggleLike = likes.toggle;

/** زر إعجاب بلا نص. */
export default function LikeButton({ id }: { id: string }) {
  const on = useLikes().includes(id);
  const label = on ? "إلغاء الإعجاب" : "أعجبني";
  return (
    <button type="button" className={`ibtn${on ? " on" : ""}`} aria-pressed={on} aria-label={label} title={label} onClick={() => toggleLike(id)}>
      <Icon name="like" size={20} />
    </button>
  );
}
