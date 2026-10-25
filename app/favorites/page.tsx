import type { Metadata } from "next";
import FavoritesList from "./FavoritesList";

export const metadata: Metadata = { title: "المفضلة", robots: { index: false } };

export default function Favorites() {
  return (
    <>
      <h1 className="page-title">المفضلة</h1>
      <p className="empty-note" style={{ paddingBlock: 0, paddingBottom: 12 }}>
        تُحفظ المفضلة على هذا الجهاز وهذا المتصفح فقط.
      </p>
      <FavoritesList />
    </>
  );
}
