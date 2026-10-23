"use client";

import Icon from "@/components/Icon";
import { createLocalSet } from "@/lib/localSet";

const favorites = createLocalSet("favorites");

/** قائمة معرّفات المفضلة (فارغة على الخادم). */
export const useFavorites = favorites.useIds;
export const toggleFavorite = favorites.toggle;

/** زر قلب بلا نص: إضافة الفيديو إلى المفضلة أو إزالته منها. */
export default function FavoriteButton({ id, showLabel = false }: { id: string; showLabel?: boolean }) {
  const on = useFavorites().includes(id);
  const label = on ? "إزالة من المفضلة" : "إضافة إلى المفضلة";
  return (
    <button type="button" className={`ibtn${showLabel ? " ibtn--text" : ""}${on ? " on" : ""}`} aria-pressed={on} aria-label={label} title={label} onClick={() => toggleFavorite(id)}>
      <Icon name="heart" size={20} />
      {showLabel && <span>{on ? "في المفضلة" : "المفضلة"}</span>}
    </button>
  );
}
