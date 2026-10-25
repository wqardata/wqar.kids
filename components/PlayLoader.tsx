"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { useSettings } from "@/lib/settings";

/**
 * شاشة «جاري التشغيل» فوق المشغّل أثناء التحميل: شعار الموقع يقفز بين نقاط ملوّنة، وتحته الكلمة بنقاط متحرّكة.
 * تتلاشى بسلاسة حين يصبح show=false ثم تُزال من الصفحة.
 * يجب أن يكون أبوها position: relative (المشغّلات كلها كذلك).
 */
export default function PlayLoader({ show, label = "جاري التشغيل" }: { show: boolean; label?: string }) {
  const { settings } = useSettings();
  const [mounted, setMounted] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 450);
    return () => clearTimeout(t);
  }, [show]);

  if (!mounted) return null;
  return (
    <div className={show ? "playload" : "playload playload--out"} role="status" aria-live="polite" aria-label={label}>
      <div className="pl-stage" aria-hidden="true">
        <span className="pl-ring" />
        <span className="pl-orbit">
          <i /><i /><i /><i /><i /><i />
        </span>
        <div className="pl-logo">
          {settings.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo} alt="" />
          ) : (
            <span className="pl-fallback"><Icon name="play" size={34} /></span>
          )}
        </div>
      </div>
      {!settings.logo && settings.showName && <p className="pl-name" aria-hidden="true">{settings.siteName}</p>}
      <p className="pl-text">
        {label}
        <span className="pl-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
      </p>
    </div>
  );
}
