"use client";
// موقع الزائر للأذان والأذكار: تلقائي بالكامل، بلا أي إعداد من المستخدم.
// الترتيب: موقع الجهاز (بإذن المتصفح) ← تقدير من المنطقة الزمنية ← إحداثيات احتياطية.
import { useEffect, useState } from "react";
import { FALLBACK_COORDS } from "@/lib/adhanCore";
import { approxFromTimezone } from "@/lib/tzLocation";

export type Coords = { lat: number; lng: number };

const POS_KEY = "adhan-pos";
const DENIED_KEY = "adhan-geo-denied";
const EVT = "adhan-pos-change";
/** نجدّد موقع الجهاز بعد هذه المدة (كي يتبع الزائر إن سافر) دون إزعاجه: إن كان الإذن ممنوحًا فلا يظهر له شيء. */
const REFRESH_MS = 12 * 3600_000;
/** بعد رفض الإذن لا نسأل من جديد قبل مرور هذه المدة. */
const RETRY_DENIED_MS = 3 * 86_400_000;

type Saved = Coords & { at: number };

function readSaved(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as Partial<Saved> | null;
    if (s && Number.isFinite(s.lat) && Number.isFinite(s.lng)) return { lat: s.lat as number, lng: s.lng as number, at: Number(s.at) || 0 };
  } catch {
    /* لا بأس */
  }
  return null;
}

function deniedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(DENIED_KEY));
    return Number.isFinite(t) && t > 0 && Date.now() - t < RETRY_DENIED_MS;
  } catch {
    return false;
  }
}

let inflight: Promise<void> | null = null;

/** يطلب موقع الجهاز مرة واحدة (النافذتان تتشاركان الطلب) ويحفظه؛ الفشل صامت. */
function refreshPosition(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      if (!navigator.geolocation) return;
      // إن كان المتصفح يخبرنا أن الإذن مرفوض فلا نكرّر الطلب.
      try {
        const st = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
        if (st?.state === "denied") return;
      } catch {
        /* المتصفح بلا واجهة الأذونات: نكمل */
      }
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (g) => {
            try {
              localStorage.setItem(POS_KEY, JSON.stringify({ lat: g.coords.latitude, lng: g.coords.longitude, at: Date.now() }));
              localStorage.removeItem(DENIED_KEY);
            } catch {
              /* التخزين غير متاح */
            }
            window.dispatchEvent(new Event(EVT));
            resolve();
          },
          (err) => {
            // نسجّل الرفض فقط حين يرفض الزائر فعلًا (لا عند انتهاء المهلة أو تعذّر القراءة).
            if (err.code === 1) {
              try { localStorage.setItem(DENIED_KEY, String(Date.now())); } catch { /* لا بأس */ }
            }
            resolve();
          },
          { timeout: 10_000, maximumAge: 3_600_000 },
        );
      });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * الإحداثيات المعتمدة للزائر الآن. تتحدّث تلقائيًا إذا وصل موقع الجهاز لاحقًا.
 * request=false: لا يسأل المتصفح عن الإذن أبدًا (للمعاينة في لوحة التحكم)، يكتفي بالمحفوظ أو التقدير.
 */
export function useAutoLocation(enabled = true, request = true): { coords: Coords; ready: boolean } {
  const [coords, setCoords] = useState<Coords>(() => FALLBACK_COORDS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const pick = () => {
      const saved = readSaved();
      setCoords(saved ?? approxFromTimezone() ?? FALLBACK_COORDS);
      setReady(true);
    };
    pick();
    window.addEventListener(EVT, pick);
    window.addEventListener("storage", pick);
    if (request && !deniedRecently()) {
      const saved = readSaved();
      if (!saved || Date.now() - saved.at > REFRESH_MS) void refreshPosition();
    }
    return () => {
      window.removeEventListener(EVT, pick);
      window.removeEventListener("storage", pick);
    };
  }, [enabled, request]);

  return { coords, ready };
}
