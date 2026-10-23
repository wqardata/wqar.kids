import type { Metadata } from "next";
import SupportSection from "./SupportSection";

export const metadata: Metadata = { title: "ادعمنا" };

export default function Support() {
  return (
    <div className="prose">
      <h1>ادعمنا</h1>
      <SupportSection />
      <h2>طرق أخرى للدعم</h2>
      <ul className="bullets">
        <li>شارك الموقع مع أصدقائك وعائلتك.</li>
        <li>أضف الحلقات التي تحبها إلى المفضلة.</li>
        <li>أخبرنا برأيك عبر صفحة «تواصل معنا».</li>
      </ul>
    </div>
  );
}
