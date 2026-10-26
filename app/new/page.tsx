import type { Metadata } from "next";
import NewVideos from "@/components/NewVideos";

export const metadata: Metadata = { title: "الجديد" };

export default function New() {
  return (
    <>
      <h1 className="page-title">الجديد</h1>
      <NewVideos />
    </>
  );
}
