"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { IDENTITY } from "@/lib/identity";
import { brandStyle, useSettings, type SiteSettings, type SplashCfg } from "@/lib/settings";

// يظهر مرة واحدة لكل فتح للموقع (لا يتكرر عند التنقل داخله والعودة للرئيسية).
let shownOnce = false;

/**
 * رسم شاشة الشعار نفسها (يستعملها الموقع ومعاينة لوحة التحكم).
 * الحركة كلها CSS: دخول (anim) ثم حركة مستمرة (motion) ثم خروج (out) ينتهي عند `duration`.
 */
export function SplashView({ settings, cfg, contained = false }: { settings: SiteSettings; cfg: SplashCfg; contained?: boolean }) {
  const img = cfg.image || IDENTITY.splashImage || settings.logo;
  const style = {
    "--sp-total": `${cfg.duration}s`,
    ...(cfg.bg ? { background: cfg.bg } : null),
  } as CSSProperties;
  return (
    <div className={`splash${contained ? " splash--box" : ""}`} data-out={cfg.out} style={style} aria-hidden="true">
      <div className="splash-exit">
        <div className="splash-brand brand" data-in={cfg.anim} style={{ ...brandStyle(settings), fontSize: Math.round(settings.brandSize * 1.8) }}>
          <div className="splash-motion" data-motion={cfg.motion}>
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="brand-logo" style={{ height: contained ? Math.min(cfg.size, 140) : cfg.size }} />
            )}
          </div>
          {/* الاسم يظهر إن لم توجد صورة، أو إن اختار المشرف إظهاره تحت الصورة */}
          {(!img || cfg.showName) && <span className="brand-name">{settings.siteName}</span>}
        </div>
      </div>
    </div>
  );
}

/** شعار الموقع (أو صورة مخصّصة) في منتصف الشاشة عند فتح الموقع، بحسب إعدادات «المظهر»، ثم يختفي. */
export default function Splash() {
  const { settings } = useSettings();
  const cfg = settings.splashCfg;
  // على الخادم نعرضه دائمًا ليكون في أول HTML (بلا وميض للمحتوى)؛ في المتصفح لا يظهر إن سبق عرضه.
  const [show, setShow] = useState(() => (typeof window === "undefined" ? true : !shownOnce));

  useEffect(() => {
    shownOnce = true;
    if (!show) return;
    const t = setTimeout(() => setShow(false), cfg.duration * 1000);
    return () => clearTimeout(t);
  }, [show, cfg.duration]);

  if (!settings.splash || !show) return null;
  return <SplashView settings={settings} cfg={cfg} />;
}
