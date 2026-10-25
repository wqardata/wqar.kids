"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import InstallCard from "@/components/InstallCard";
import { useSettings } from "@/lib/settings";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

declare global {
  interface Window { __bip?: BIPEvent | null }
}

const KEY = "install-dismissed";

function snoozed(days: number): boolean {
  if (days <= 0) return false;
  try {
    const t = Number(localStorage.getItem(KEY));
    return Number.isFinite(t) && t > 0 && Date.now() - t < days * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

/**
 * نافذة تثبيت الموقع كتطبيق على الهاتف والكمبيوتر، ومكانها ووقتها ونصوصها من «إعدادات الموقع».
 * كروم/إيدج/أندرويد: زر يثبّته مباشرة (حدث beforeinstallprompt يلتقطه سكربت في <head> مبكرًا كي لا يفوتنا).
 * آيفون وسفاري: خطوات يدوية. فايرفوكس سطح المكتب لا يدعم تثبيت المواقع فلا تظهر له النافذة.
 */
export default function InstallPrompt() {
  const { settings } = useSettings();
  const cfg = settings.install;
  const path = usePathname();
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [manual, setManual] = useState(false); // iOS أو سفاري: خطوات يدوية
  const [safariDesktop, setSafariDesktop] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [delayed, setDelayed] = useState(false); // انقضى وقت التأخير
  const [closed, setClosed] = useState(false);

  // الالتقاط وتحديد نوع الجهاز: مرة واحدة عند التحميل.
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(ua);
    setMobile(isIos || /android|mobile/i.test(ua));

    const onBip = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const onReady = () => {
      if (window.__bip) onBip(window.__bip);
    };
    const onInstalled = () => { setEvt(null); setClosed(true); window.__bip = null; };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("bip-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    onReady(); // الحدث وصل قبل تحميل هذا المكوّن

    // سفاري (آيفون أو ماك) بلا حدث تثبيت: خطوات يدوية.
    if (isIos || isSafari) {
      setManual(true);
      setSafariDesktop(!isIos);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("bip-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canInstall = Boolean(evt) || manual;
  const allowedDevice = mobile ? cfg.mobile : cfg.desktop;
  const eligible = cfg.enabled && allowedDevice && canInstall && !standalone && !closed && (!cfg.homeOnly || path === "/");

  // وقت الظهور: بعد التأخير المحدَّد (وتُحترم مدة الإخفاء بعد الإغلاق).
  useEffect(() => {
    setDelayed(false);
    if (!eligible || snoozed(cfg.snoozeDays)) return;
    const t = setTimeout(() => setDelayed(true), Math.max(cfg.delaySec, manual && !evt ? 1.5 : 0) * 1000);
    return () => clearTimeout(t);
  }, [eligible, cfg.delaySec, cfg.snoozeDays, manual, evt]);

  function dismiss() {
    setClosed(true);
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
  }

  async function install() {
    if (!evt) return;
    setClosed(true);
    await evt.prompt();
    const { outcome } = await evt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    setEvt(null);
    if (outcome === "dismissed") { try { localStorage.setItem(KEY, String(Date.now())); } catch {} }
  }

  if (!eligible || !delayed) return null;
  const name = settings.tabName || settings.siteName;
  return (
    <div className={`install install--m-${cfg.posMobile} install--d-${cfg.posDesktop}`} role="dialog" aria-label="تثبيت التطبيق">
      <InstallCard install={cfg} name={name} canPrompt={Boolean(evt)} safariDesktop={safariDesktop} onInstall={() => void install()} onClose={dismiss} />
    </div>
  );
}
