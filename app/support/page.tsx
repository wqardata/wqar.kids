import type { Metadata } from "next";
import { SITE_NAME, SUPPORT_LINKS } from "@/lib/data";

export const metadata: Metadata = { title: "ادعمنا" };

export default function Support() {
  return (
    <div className="prose">
      <h1>ادعمنا</h1>
      <p>{SITE_NAME} موقع بلا إعلانات، ودعمك يساعدنا على الاستمرار وإضافة حلقات جديدة.</p>
      {SUPPORT_LINKS.length > 0 ? (
        <ul className="groups">
          {SUPPORT_LINKS.map((l) => (
            <li key={l.href}>
              <a className="group" href={l.href} target="_blank" rel="noopener noreferrer">
                <strong>{l.label}</strong>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>طرق الدعم المالي ستُضاف قريبًا.</p>
      )}
      <h2>طرق أخرى للدعم</h2>
      <ul className="bullets">
        <li>شارك الموقع مع أصدقائك وعائلتك.</li>
        <li>أضف الحلقات التي تحبها إلى المفضلة.</li>
        <li>أخبرنا برأيك عبر صفحة «تواصل معنا».</li>
      </ul>
    </div>
  );
}
