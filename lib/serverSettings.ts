import { DEFAULT_SETTINGS, merge, type SiteSettings } from "./settingsCore";

export const SETTINGS_TAG = "site-settings";

type FsValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  arrayValue?: { values?: FsValue[] };
  mapValue?: { fields?: Record<string, FsValue> };
  timestampValue?: string;
};

function decode(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return (v.arrayValue?.values ?? []).map(decode);
  if ("mapValue" in v) return decodeFields(v.mapValue?.fields ?? {});
  if ("timestampValue" in v) return v.timestampValue;
  return null;
}

export function decodeFields(f: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));
}

/**
 * يقرأ settings/site من Firestore على الخادم (القراءة عامة في القواعد).
 * النتيجة مخزّنة بوسم SETTINGS_TAG ويُبطَل تخزينها فور حفظ الإعدادات من لوحة التحكم،
 * فيظهر الاسم والشعار الصحيحان في HTML نفسه دون وميض الاسم القديم.
 */
export async function getServerSettings(): Promise<SiteSettings> {
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!pid) return DEFAULT_SETTINGS;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents/settings/site${key ? `?key=${encodeURIComponent(key)}` : ""}`;
    const r = await fetch(url, { next: { revalidate: 300, tags: [SETTINGS_TAG] }, signal: AbortSignal.timeout(6000) });
    if (r.status === 404) return DEFAULT_SETTINGS;
    if (!r.ok) return DEFAULT_SETTINGS;
    const j = (await r.json()) as { fields?: Record<string, FsValue> };
    return merge(decodeFields(j.fields ?? {}));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** بصمة قصيرة لنص (لتغيير رابط الأيقونة عند تغيير الشعار). */
export function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
