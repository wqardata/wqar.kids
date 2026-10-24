import type { Metadata } from "next";
import LiveSection from "./LiveSection";

export const metadata: Metadata = { title: "بث مباشر" };

export default function Live() {
  return (
    <div className="empty">
      <h1>بث مباشر</h1>
      <LiveSection />
    </div>
  );
}
