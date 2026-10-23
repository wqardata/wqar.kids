import type { Metadata } from "next";
import LikedList from "./LikedList";

export const metadata: Metadata = { title: "أعجبني", robots: { index: false } };

export default function Liked() {
  return (
    <>
      <h1 className="page-title">الفيديوهات التي أعجبتني</h1>
      <p className="empty-note" style={{ paddingBlock: 0, paddingBottom: 12 }}>
        تُحفظ على هذا الجهاز وهذا المتصفح فقط.
      </p>
      <LikedList />
    </>
  );
}
