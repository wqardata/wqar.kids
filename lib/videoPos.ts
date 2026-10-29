// موضع التشغيل المحفوظ لفيديوهات درايف (للاستئناف): في متصفح الزائر فقط (localStorage)، بلا أي طلب إلى الخادم أو قاعدة البيانات.
import { isPreviewFrame } from "./previewFrame";

const KEY = "video-pos";
const MAX = 100;
/** لا نحفظ ما قبل هذه الثواني (فتح عابر)، ولا ما بلغ هذه النسبة من المدة (اعتُبر منتهيًا). */
export const POS_MIN_SEC = 10;
export const POS_DONE_RATIO = 0.9;

type Store = Record<string, [t: number, d: number, at: number]>;

function read(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Store) : {};
  } catch {
    return {};
  }
}

function write(s: Store) {
  const keys = Object.keys(s);
  if (keys.length > MAX) {
    keys.sort((a, b) => s[a][2] - s[b][2]);
    for (const k of keys.slice(0, keys.length - MAX)) delete s[k];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* التخزين غير متاح (وضع خاص) */
  }
}

/** آخر موضع محفوظ بالثواني (0 = لا شيء). */
export function getPos(driveId: string): number {
  const e = read()[driveId];
  return e && Number.isFinite(e[0]) && e[0] >= POS_MIN_SEC ? e[0] : 0;
}

/** يحفظ الموضع؛ وإن انتهى الفيديو تقريبًا (أو لم يبدأ فعلًا) يمسحه فيبدأ المرة القادمة من أوله. */
export function savePos(driveId: string, t: number, d: number) {
  if (isPreviewFrame() || !Number.isFinite(t) || !Number.isFinite(d) || d <= 0) return;
  const s = read();
  if (t < POS_MIN_SEC || t >= d * POS_DONE_RATIO) delete s[driveId];
  else s[driveId] = [Math.floor(t), Math.floor(d), Date.now()];
  write(s);
}

export function clearPos(driveId: string) {
  const s = read();
  if (driveId in s) {
    delete s[driveId];
    write(s);
  }
}
