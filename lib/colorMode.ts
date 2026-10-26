// لون العرض الذي يختاره الزائر: تلقائي (حسب الجهاز) أو فاتح أو داكن. يُحفظ في المتصفح فقط.
import { effectiveColors, type Theme } from "./theme";

export type ColorMode = "auto" | "light" | "dark";
export const COLOR_MODE_KEY = "color-mode";

/** الوضع الحالي كما ضبطه سكربت <head> قبل الرسم. */
export function readColorMode(): ColorMode {
  const t = typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null;
  return t === "light" || t === "dark" ? t : "auto";
}

/** يطبّق الوضع على الصفحة ويحفظه، ويحدّث لون شريط المتصفح ليوافقه. */
export function applyColorMode(mode: ColorMode, theme: Theme) {
  const root = document.documentElement;
  if (mode === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  try {
    if (mode === "auto") localStorage.removeItem(COLOR_MODE_KEY);
    else localStorage.setItem(COLOR_MODE_KEY, mode);
  } catch {
    /* التخزين غير متاح: يبقى الاختيار لهذه الجلسة فقط */
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const dark = mode === "auto" ? (m.media || "").includes("dark") : mode === "dark";
    m.content = effectiveColors(theme, dark ? "dark" : "light").bg;
  });
}
