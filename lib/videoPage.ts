// تصميم صفحة الفيديو القابل للتعديل من لوحة التحكم. منطق نقي (يعمل في الخادم والمتصفح).
import { MENU_ICONS, type IconName } from "./data";

export const BUILTIN_BUTTONS = ["favorite", "like", "share", "report"] as const;
export type BuiltinButton = (typeof BUILTIN_BUTTONS)[number];

export const BUILTIN_LABEL: Record<BuiltinButton, string> = {
  favorite: "المفضلة",
  like: "أعجبني",
  share: "مشاركة",
  report: "إبلاغ",
};

/** زر في صفحة الفيديو: مدمج (kind = اسمه) أو مخصّص (kind = "custom" مع رابط). */
export type VideoButton = {
  id: string;
  kind: BuiltinButton | "custom";
  on: boolean;
  /** إظهار الكلمة بجانب الأيقونة. */
  showLabel: boolean;
  /** للمخصّص فقط: */
  label: string;
  icon: IconName;
  /** رابط يقبل {id} {title} {driveId} {url} (تُستبدل بقيم الفيديو). http/https فقط. */
  url: string;
  newTab: boolean;
};

export type VideoPageConfig = {
  buttons: VideoButton[];
  showMeta: boolean;
  showDescription: boolean;
  showSuggested: boolean;
};

const base = { label: "", icon: "link" as IconName, url: "", newTab: true };

export const DEFAULT_VIDEO_PAGE: VideoPageConfig = {
  buttons: [
    { id: "favorite", kind: "favorite", on: true, showLabel: false, ...base },
    { id: "like", kind: "like", on: true, showLabel: false, ...base },
    { id: "share", kind: "share", on: false, showLabel: false, ...base },
    { id: "report", kind: "report", on: true, showLabel: true, ...base },
  ],
  showMeta: true,
  showDescription: true,
  showSuggested: true,
};

export const MAX_CUSTOM_BUTTONS = 8;

/** يستبدل متغيرات الرابط بقيم الفيديو (مرمَّزة) ويقبل http/https فقط؛ وإلا يعيد "". */
export function buildButtonUrl(template: string, v: { id: string; title: string; driveId: string }, pageUrl: string): string {
  const out = template
    .replaceAll("{id}", encodeURIComponent(v.id))
    .replaceAll("{title}", encodeURIComponent(v.title))
    .replaceAll("{driveId}", encodeURIComponent(v.driveId))
    .replaceAll("{url}", encodeURIComponent(pageUrl));
  try {
    const u = new URL(out.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/** هل القالب صالح؟ (يُفحص بقيم تجريبية). */
export function validTemplate(t: string): boolean {
  return buildButtonUrl(t, { id: "x", title: "x", driveId: "x" }, "https://example.com/") !== "";
}

export function cleanVideoPage(v: unknown): VideoPageConfig {
  const d = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const flag = (k: string, dflt: boolean) => (typeof d[k] === "boolean" ? (d[k] as boolean) : dflt);
  const out: VideoButton[] = [];
  const seen = new Set<string>();
  let customs = 0;
  if (Array.isArray(d.buttons)) {
    for (const raw of d.buttons) {
      const o = (raw ?? {}) as Record<string, unknown>;
      const id = typeof o.id === "string" && /^[a-z0-9-]{1,24}$/.test(o.id) ? o.id : "";
      if (!id || seen.has(id)) continue;
      const kind = o.kind;
      const on = o.on !== false;
      const showLabel = o.showLabel === true;
      if (BUILTIN_BUTTONS.some((b) => b === kind)) {
        if (id !== kind) continue; // المدمج معرّفه = اسمه
        seen.add(id);
        out.push({ id, kind: kind as BuiltinButton, on, showLabel, ...base });
      } else if (kind === "custom" && customs < MAX_CUSTOM_BUTTONS) {
        const label = typeof o.label === "string" ? o.label.trim().slice(0, 24) : "";
        const url = typeof o.url === "string" ? o.url.trim().slice(0, 500) : "";
        const icon = MENU_ICONS.find((i) => i === o.icon) ?? "link";
        if (!label || !validTemplate(url)) continue;
        seen.add(id);
        customs++;
        out.push({ id, kind: "custom", on, showLabel: showLabel || false, label, icon, url, newTab: o.newTab !== false });
      }
    }
  }
  // أي زر مدمج غاب يُضاف بقيمته الافتراضية (حتى لا يضيع بعد تحديث لاحق).
  for (const b of DEFAULT_VIDEO_PAGE.buttons) if (!seen.has(b.id)) out.push({ ...b });
  return {
    buttons: out,
    showMeta: flag("showMeta", true),
    showDescription: flag("showDescription", true),
    showSuggested: flag("showSuggested", true),
  };
}
