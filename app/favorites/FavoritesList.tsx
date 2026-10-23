"use client";

import EpisodeGrid from "@/components/EpisodeGrid";
import { useFavorites } from "@/components/FavoriteButton";
import { episodes } from "@/lib/data";

export default function FavoritesList() {
  const ids = useFavorites();
  const items = episodes.filter((e) => ids.includes(e.id));
  if (items.length === 0) {
    return <p className="empty-note">لم تضف أي حلقة إلى المفضلة بعد. افتح حلقة واضغط «أضف للمفضلة».</p>;
  }
  return <EpisodeGrid items={items} />;
}
