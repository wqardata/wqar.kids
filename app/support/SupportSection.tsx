"use client";
import { useSettings } from "@/lib/settings";

export default function SupportSection() {
  const { settings } = useSettings();
  return (
    <>
      <p>{settings.siteName} موقع بلا إعلانات، ودعمك يساعدنا على الاستمرار وإضافة حلقات جديدة.</p>
      {settings.supportLinks.length > 0 ? (
        <ul className="groups">
          {settings.supportLinks.map((l) => (
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
    </>
  );
}
