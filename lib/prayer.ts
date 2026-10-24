import { METHODS, PRAYERS, type AdhanSettings, type PrayerId } from "./adhanCore";

const D2R = Math.PI / 180;
const sin = (d: number) => Math.sin(d * D2R);
const cos = (d: number) => Math.cos(d * D2R);
const acosD = (x: number) => Math.acos(Math.min(1, Math.max(-1, x))) / D2R;
const fixHour = (h: number) => ((h % 24) + 24) % 24;
const fixDeg = (d: number) => ((d % 360) + 360) % 360;

/** موضع الشمس (الميل ومعادلة الزمن) ليوم UTC معيّن عند الظهيرة. */
function sun(y: number, m: number, d: number) {
  const jd = Date.UTC(y, m, d, 12) / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const g = fixDeg(357.529 + 0.98560028 * n);
  const q = fixDeg(280.459 + 0.98564736 * n);
  const L = fixDeg(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * n;
  const ra = fixHour(Math.atan2(cos(e) * sin(L), cos(L)) / D2R / 15);
  const decl = Math.asin(sin(e) * sin(L)) / D2R;
  const eqt = q / 15 - ra;
  return { decl, eqt: ((eqt + 12) % 24 + 24) % 24 - 12 };
}

export type DayTimes = Record<PrayerId, Date>;

/** مواقيت يوم محلي (y-m-d في موقع المدينة) كلحظات مطلقة؛ لا تعتمد على منطقة جهاز الزائر. */
export function timesForDay(y: number, m: number, d: number, lat: number, lng: number, a: AdhanSettings): DayTimes {
  const { decl, eqt } = sun(y, m, d);
  const noon = 12 - lng / 15 - eqt; // ساعات UTC
  const half = (alt: number) => acosD((sin(alt) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl))) / 15;
  const meth = METHODS.find((x) => x.id === a.method) ?? METHODS[0];
  const fajr = noon - half(-meth.fajr);
  const sunset = noon + half(-0.833);
  const factor = a.asr === "hanafi" ? 2 : 1;
  const asrAlt = Math.atan(1 / (factor + Math.tan(Math.abs(lat - decl) * D2R))) / D2R;
  const asr = noon + half(asrAlt);
  const isha = meth.ishaMin > 0 ? sunset + meth.ishaMin / 60 : noon + half(-meth.isha);
  const hours: Record<PrayerId, number> = { fajr, dhuhr: noon, asr, maghrib: sunset, isha };
  const base = Date.UTC(y, m, d);
  const out = {} as DayTimes;
  for (const p of PRAYERS) {
    // التقريب إلى أقرب دقيقة ثم التعديل اليدوي.
    const mins = Math.round(hours[p.id] * 60) + a.adjust[p.id];
    out[p.id] = new Date(base + mins * 60000);
  }
  return out;
}

export type Slot = { id: PrayerId; label: string; at: Date };

/** مواقيت أمس واليوم وغدًا مرتّبة، لتحديد الصلاة الحالية والقادمة. */
export function slotsAround(now: Date, lat: number, lng: number, a: AdhanSettings): Slot[] {
  // تاريخ الموقع المحلي تقريبًا من خط الطول.
  const local = new Date(now.getTime() + (lng / 15) * 3600000);
  const out: Slot[] = [];
  for (const off of [-1, 0, 1]) {
    const t = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + off));
    const times = timesForDay(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), lat, lng, a);
    for (const p of PRAYERS) out.push({ id: p.id, label: p.label, at: times[p.id] });
  }
  return out.sort((x, y) => x.at.getTime() - y.at.getTime());
}
