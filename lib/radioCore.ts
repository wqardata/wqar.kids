// إعدادات الإذاعة (نقية: تعمل في الخادم والمتصفح): قائمة أناشيد صوتية من درايف.
import { parseDriveId } from "./drive";

export type Nasheed = {
  id: string;
  title: string;
  /** معرّف الملف الصوتي في درايف (يُستخرج من الرابط عند الحفظ). أثناء التحرير في اللوحة قد يحوي الرابط الخام. */
  drive: string;
};

export type RadioSettings = {
  items: Nasheed[];
  /** عند انتهاء آخر نشيد: true = تعود الإذاعة لأول القائمة وتستمر، false = تتوقف. */
  loop: boolean;
  /** true = ترتيب عشوائي جديد عند كل فتح للصفحة، false = ترتيب القائمة كما ضبطه المشرف. */
  shuffle: boolean;
  /** true = تبدأ الإذاعة بالتشغيل عند فتح الصفحة (إن سمح المتصفح)، false = تنتظر ضغط زر التشغيل. */
  autoplay: boolean;
};

export const RADIO_MAX = 200;
export const RADIO_TITLE_MAX = 80;
export const RADIO_RAW_MAX = 300;

export const DEFAULT_RADIO: RadioSettings = { items: [], loop: true, shuffle: true, autoplay: true };

export function newNasheedId(): string {
  return `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** ينظّف القائمة: يُهمل ما ليس له رابط درايف صالح، ويحوّل الرابط إلى معرّفه، ويعطي عنوانًا افتراضيًا لمن لا عنوان له. */
export function cleanRadio(v: unknown): RadioSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const loop = o.loop !== false;
  const shuffle = o.shuffle !== false;
  const autoplay = o.autoplay !== false;
  if (!Array.isArray(o.items)) return { ...DEFAULT_RADIO, loop, shuffle, autoplay };
  const items: Nasheed[] = [];
  const seen = new Set<string>();
  for (const raw of o.items.slice(0, RADIO_MAX)) {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const drive = typeof r.drive === "string" ? parseDriveId(r.drive.slice(0, RADIO_RAW_MAX)) : null;
    if (!drive) continue;
    let id = typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 40) : newNasheedId();
    if (seen.has(id)) id = newNasheedId();
    seen.add(id);
    const title = typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim().slice(0, RADIO_TITLE_MAX) : "";
    items.push({ id, title: title || `نشيد ${items.length + 1}`, drive });
  }
  return { items, loop, shuffle, autoplay };
}
