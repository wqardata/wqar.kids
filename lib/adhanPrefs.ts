"use client";
import { useEffect, useState } from "react";
import { ASR_MODES, CITIES, METHODS, configuredCoords, type AdhanSettings, type AsrMode, type MethodId } from "@/lib/adhanCore";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { approxFromTimezone } from "@/lib/tzLocation";

/** تفضيلات الأذان الخاصة بكل زائر (تُحفظ في متصفحه). القيمة الفارغة/null = اتّباع إعدادات الموقع. */
export type AdhanPrefs = {
  location: "default" | "auto" | "city";
  cityId: string;
  method: "" | MethodId;
  asr: "" | AsrMode;
  /** دقائق التنبيه قبل الأذان لكل الصلوات (0 = بلا تنبيه، null = إعداد الموقع). */
  remindMin: number | null;
};

export const DEFAULT_PREFS: AdhanPrefs = { location: "default", cityId: "", method: "", asr: "", remindMin: null };

const KEY = "adhan-user";
const EVT = "adhan-user-change";
export const POS_KEY = "adhan-pos";
export const DENIED_KEY = "adhan-geo-denied";

export function cleanPrefs(v: unknown): AdhanPrefs {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const rm = typeof o.remindMin === "number" && Number.isFinite(o.remindMin) ? Math.min(60, Math.max(0, Math.round(o.remindMin))) : null;
  return {
    location: o.location === "auto" || o.location === "city" ? o.location : "default",
    cityId: CITIES.some((c) => c.id === o.cityId) ? (o.cityId as string) : "",
    method: METHODS.some((m) => m.id === o.method) ? (o.method as MethodId) : "",
    asr: ASR_MODES.some((m) => m.id === o.asr) ? (o.asr as AsrMode) : "",
    remindMin: rm,
  };
}

function read(): AdhanPrefs {
  try {
    return cleanPrefs(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: AdhanPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* التخزين غير متاح */
  }
  window.dispatchEvent(new Event(EVT));
}

/** تفضيلات الزائر الحالية (تتحدّث فورًا عند تغييرها من أي مكان في الموقع). */
export function useAdhanPrefs(): AdhanPrefs {
  const [p, setP] = useState<AdhanPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    const sync = () => setP(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return p;
}

/** إعدادات الموقع بعد تطبيق تفضيلات الزائر عليها. */
export function applyPrefs(cfg: AdhanSettings, p: AdhanPrefs): AdhanSettings {
  const out: AdhanSettings = { ...cfg };
  if (p.location === "auto") out.locationMode = "auto";
  else if (p.location === "city") {
    out.locationMode = "city";
    if (p.cityId) out.cityId = p.cityId;
  }
  if (p.method) out.method = p.method;
  if (p.asr) out.asr = p.asr;
  if (p.remindMin !== null) {
    out.remind = p.remindMin > 0;
    out.remindMin = { fajr: p.remindMin, dhuhr: p.remindMin, asr: p.remindMin, maghrib: p.remindMin, isha: p.remindMin };
  }
  return out;
}

export function readSavedPos(): { lat: number; lng: number } | null {
  try {
    const s = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as { lat: number; lng: number } | null;
    return s && Number.isFinite(s.lat) && Number.isFinite(s.lng) ? s : null;
  } catch {
    return null;
  }
}

/** طلب موقع الجهاز وحفظه. يعيد null إن رُفض الإذن أو لم يتوفر. */
export function requestDevicePosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (g) => {
        const pos = { lat: g.coords.latitude, lng: g.coords.longitude };
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(pos));
          localStorage.removeItem(DENIED_KEY);
        } catch { /* لا بأس */ }
        window.dispatchEvent(new Event(EVT));
        resolve(pos);
      },
      () => {
        try { localStorage.setItem(DENIED_KEY, "1"); } catch { /* لا بأس */ }
        resolve(null);
      },
      { timeout: 12_000, maximumAge: 0 },
    );
  });
}

export function forgetDevicePosition(): void {
  try { localStorage.removeItem(POS_KEY); } catch { /* لا بأس */ }
  window.dispatchEvent(new Event(EVT));
}

/** الإحداثيات المعتمدة: تلقائي = موقع الجهاز ثم تقدير المنطقة الزمنية ثم المدينة؛ وإلا المدينة/الإحداثيات المضبوطة. */
export function effectiveCoords(cfg: AdhanSettings, auto: { lat: number; lng: number } | null): { lat: number; lng: number } {
  if (cfg.locationMode === "auto") return auto ?? approxFromTimezone() ?? configuredCoords(cfg);
  return configuredCoords(cfg);
}

/** تفضيلات الحساب المحفوظة على الخادم (userPrefs/{uid}) أو null إن لم توجد/تعذّر الجلب. */
export async function loadRemotePrefs(uid: string): Promise<AdhanPrefs | null> {
  if (!isFirebaseConfigured) return null;
  try {
    const snap = await getDoc(doc(getDb(), "userPrefs", uid));
    return snap.exists() ? cleanPrefs(snap.data().adhan) : null;
  } catch {
    return null;
  }
}

/** يحفظ تفضيلات الحساب على الخادم ليجدها المستخدم على أي جهاز. يعيد false عند الفشل (يبقى الحفظ المحلي). */
export async function saveRemotePrefs(uid: string, p: AdhanPrefs): Promise<boolean> {
  if (!isFirebaseConfigured) return false;
  try {
    await setDoc(doc(getDb(), "userPrefs", uid), { adhan: p, updatedAt: serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}
