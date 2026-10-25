import type { Metadata } from "next";
import HistoryList from "./HistoryList";
import MembersGate from "./MembersGate";

export const metadata: Metadata = { title: "سجل المشاهدة", robots: { index: false } };

export default function History() {
  return (
    <>
      <h1 className="page-title">سجل المشاهدة</h1>
      <MembersGate>
        <p className="empty-note" style={{ paddingBlock: 0, paddingBottom: 12 }}>
          يُحفظ السجل على هذا الجهاز وهذا المتصفح فقط.
        </p>
        <HistoryList />
      </MembersGate>
    </>
  );
}
