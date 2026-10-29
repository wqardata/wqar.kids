import type { Metadata } from "next";

export const metadata: Metadata = { title: "إذاعة" };

export default function Radio() {
  return (
    <div className="empty">
      <h1>إذاعة</h1>
      <p>لا توجد إذاعة حاليًا، وسنضيفها قريبًا.</p>
    </div>
  );
}
