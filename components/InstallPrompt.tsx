"use client";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";

declare global {
  interface Window { __bip?: BIPEvent | null }
}

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY = "install-dismissed";
const SNOOZE_MS = 3 * 24 * 3600 * 1000; // بعد الإغلاق نعاود الإظهار بعد 3 أيام

function snoozed(): boolean {
  try {
    const t = Number(localStorage.getItem(KEY));
    return Number.isFinite(t) && t > 0 && Date.now() - t < SNOOZE_MS;
  } catch {
    return false;
  }
}

/**
 * نافذة تثبيت الموقع كتطبيق، على الهاتف والكمبيوتر.
 * كروم/إيدج/أندرويد: زر يثبّته مباشرة (حدث beforeinstallprompt يلتقطه سكربت في <head> مبكرًا كي لا يفوتنا).
 * آيفون وسفاري: خطوات يدوية. فايرفوكس سطح المكتب لا يدعم تثبيت المواقع فلا تظهر له النافذة.
 */
export default function InstallPrompt() {
  const { settings } = useSettings();
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [safariDesktop, setSafariDesktop] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || snoozed()) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(ua);

    const onBip = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setShow(true);
    };
    const onReady = () => {
      if (window.__bip) onBip(window.__bip);
    };
    const onInstalled = () => { setShow(false); setEvt(null); window.__bip = null; };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("bip-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    onReady(); // الحدث وصل قبل تحميل هذا المكوّن

    // سفاري (آيفون أو ماك) بلا حدث تثبيت: نعرض الخطوات اليدوية.
    let t: ReturnType<typeof setTimeout> | undefined;
    if (isIos || isSafari) {
      setIos(true);
      setSafariDesktop(!isIos);
      t = setTimeout(() => setShow(true), 1500);
    }
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("bip-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
  }

  async function install() {
    if (!evt) return;
    setShow(false);
    await evt.prompt();
    const { outcome } = await evt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    setEvt(null);
    if (outcome === "dismissed") { try { localStorage.setItem(KEY, String(Date.now())); } catch {} }
  }

  if (!show || (!evt && !ios)) return null;
  const name = settings.tabName || settings.siteName;
  return (
    <div className="install" role="dialog" aria-label="تثبيت التطبيق">
      <div className="install-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" />
        <div>
          <strong>ثبّت تطبيق {name}</strong>
          <small>وصول أسرع، وتفتح في نافذة مستقلة كأي برنامج</small>
        </div>
        <button type="button" className="install-x" aria-label="إغلاق" onClick={dismiss}>✕</button>
      </div>
      {evt ? (
        <button type="button" className="btn" onClick={() => void install()}>تثبيت التطبيق</button>
      ) : (
        <p className="install-steps">
          {safariDesktop ? (
            <>من قائمة <b>ملف</b> في سفاري اختر <b>«إضافة إلى Dock»</b>.</>
          ) : (
            <>اضغط زر المشاركة <b>⎋</b> في أسفل سفاري، ثم اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.</>
          )}
        </p>
      )}
    </div>
  );
}
