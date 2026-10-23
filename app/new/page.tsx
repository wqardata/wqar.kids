import type { Metadata } from "next";
import AddedVideos from "@/components/AddedVideos";

export const metadata: Metadata = { title: "الجديد" };

export default function New() {
  return (
    <>
      <h1 className="page-title">الجديد</h1>
      <AddedVideos showHeading={false} emptyNote="لا توجد فيديوهات بعد." />
    </>
  );
}
