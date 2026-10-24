import type { Metadata } from "next";
import AddTabs from "./AddTabs";

export const metadata: Metadata = { title: "إضافة فيديو" };

export default function AddVideo() {
  return (
    <div className="auth auth--wide">
      <h1>إضافة فيديو</h1>
      <AddTabs />
    </div>
  );
}
