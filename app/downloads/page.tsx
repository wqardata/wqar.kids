import type { Metadata } from "next";
import DownloadsList from "./DownloadsList";

export const metadata: Metadata = { title: "التنزيلات" };

export default function Downloads() {
  return (
    <>
      <h1 className="page-title">التنزيلات</h1>
      <DownloadsList />
    </>
  );
}
