"use client";
import { useEffect, useState } from "react";
import { brandStyle, useSettings } from "@/lib/settings";

// يظهر مرة واحدة لكل فتح للموقع (لا يتكرر عند التنقل داخله والعودة للرئيسية).
let shownOnce = false;

/** شعار الموقع وحده في منتصف الشاشة لثانية تقريبًا عند فتح الموقع، ثم يتلاشى. */
export default function Splash() {
  const { settings } = useSettings();
  // على الخادم نعرضه دائمًا ليكون في أول HTML (بلا وميض للمحتوى)؛ في المتصفح لا يظهر إن سبق عرضه.
  const [show, setShow] = useState(() => (typeof window === "undefined" ? true : !shownOnce));

  useEffect(() => {
    shownOnce = true;
    if (!show) return;
    const t = setTimeout(() => setShow(false), 1300);
    return () => clearTimeout(t);
  }, [show]);

  if (!settings.splash || !show) return null;
  const logoH = Math.max(80, Math.round(settings.logoHeight * 2.5));
  return (
    <div className="splash" aria-hidden="true">
      <div className="brand splash-brand" style={{ ...brandStyle(settings), fontSize: Math.round(settings.brandSize * 1.8) }}>
        {settings.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logo} alt="" className="brand-logo" style={{ height: logoH }} />
        )}
        {/* الشعار وحده؛ الاسم يظهر فقط إن لم يُرفع شعار */}
        {!settings.logo && <span className="brand-name">{settings.siteName}</span>}
      </div>
    </div>
  );
}
