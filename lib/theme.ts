// إعدادات مظهر الموقع (ألوان الوضعين + الخطوط + الحجم) وتوليد CSS منها.
// بلا "use client" كي يمكن استخدامه في أي مكان؛ كل القيم تُنظَّف قبل أن تدخل في CSS.

export const COLOR_KEYS = ["bg", "surface", "ink", "mute", "line", "accent", "accentInk"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
export type ColorSet = Record<ColorKey, string>;

/** وصف كل لون في لوحة التحكم. */
export const COLOR_LABELS: Record<ColorKey, { label: string; hint: string }> = {
  bg: { label: "خلفية الصفحة", hint: "الخلفية العامة للموقع" },
  surface: { label: "خلفية البطاقات", hint: "البطاقات والحقول والقوائم" },
  ink: { label: "لون النص", hint: "النصوص الرئيسية والعناوين" },
  mute: { label: "النص الثانوي", hint: "الأوصاف والتفاصيل الصغيرة" },
  line: { label: "الحدود", hint: "الخطوط الفاصلة وحدود البطاقات" },
  accent: { label: "اللون المميّز", hint: "الأزرار والروابط النشطة والاسم" },
  accentInk: { label: "نص الأزرار", hint: "النص فوق اللون المميّز (يُختار تلقائيًا إن تُرك فارغًا)" },
};

/** ألوان الموقع الافتراضية الحالية (مطابقة لـ globals.css). */
export const DEFAULT_COLORS: { light: ColorSet; dark: ColorSet } = {
  light: { bg: "#f2f6f4", surface: "#ffffff", ink: "#10263a", mute: "#5b6f7f", line: "#d9e3de", accent: "#087a68", accentInk: "#ffffff" },
  dark: { bg: "#0f1a24", surface: "#172635", ink: "#e8f0f4", mute: "#93a8b6", line: "#243749", accent: "#2cc4a8", accentInk: "#06231d" },
};

const EMPTY: ColorSet = { bg: "", surface: "", ink: "", mute: "", line: "", accent: "", accentInk: "" };

/** ألوان جاهزة بنقرة واحدة. كل لوحة تحدد الوضعين معًا. */
export const PRESETS: { id: string; label: string; light: Partial<ColorSet>; dark: Partial<ColorSet> }[] = [
  { id: "default", label: "الافتراضي (أخضر مائي)", light: {}, dark: {} },
  {
    id: "ocean",
    label: "أزرق المحيط",
    light: { bg: "#f1f5fa", surface: "#ffffff", ink: "#0f2238", mute: "#56697d", line: "#d6e0eb", accent: "#1d5fb4", accentInk: "#ffffff" },
    dark: { bg: "#0d1622", surface: "#152233", ink: "#e6eef7", mute: "#8fa5ba", line: "#233449", accent: "#62a0ea", accentInk: "#0a1a2c" },
  },
  {
    id: "royal",
    label: "بنفسجي ملكي",
    light: { bg: "#f6f3fa", surface: "#ffffff", ink: "#241638", mute: "#6a5b7c", line: "#e0d8ea", accent: "#6b3fa0", accentInk: "#ffffff" },
    dark: { bg: "#150f20", surface: "#201832", ink: "#eee8f6", mute: "#a99bbd", line: "#33274a", accent: "#b794f0", accentInk: "#1c1130" },
  },
  {
    id: "sunset",
    label: "برتقالي دافئ",
    light: { bg: "#faf4ee", surface: "#ffffff", ink: "#33200f", mute: "#7a6350", line: "#ecdfd1", accent: "#a84a00", accentInk: "#ffffff" },
    dark: { bg: "#1a120b", surface: "#271b11", ink: "#f6ece1", mute: "#b9a08a", line: "#3d2c1c", accent: "#ff9a4d", accentInk: "#2a1300" },
  },
  {
    id: "rose",
    label: "وردي",
    light: { bg: "#fbf3f5", surface: "#ffffff", ink: "#3a1220", mute: "#7d5a67", line: "#efdce2", accent: "#b0243f", accentInk: "#ffffff" },
    dark: { bg: "#1b0f14", surface: "#291820", ink: "#f8e9ee", mute: "#bb9aa7", line: "#412630", accent: "#ff7a95", accentInk: "#2c0a14" },
  },
  {
    id: "graphite",
    label: "رمادي هادئ",
    light: { bg: "#f3f4f5", surface: "#ffffff", ink: "#1b1f23", mute: "#5f666d", line: "#dcdfe2", accent: "#2f3b47", accentInk: "#ffffff" },
    dark: { bg: "#111315", surface: "#1b1e21", ink: "#eceef0", mute: "#9aa1a8", line: "#2b3034", accent: "#c3ccd5", accentInk: "#12161a" },
  },
];

/** خطوط الموقع. تُحمَّل من layout.tsx ولا تُنزَّل إلا عند استعمالها. */
export const SITE_FONTS = [
  { id: "default", label: "Readex Pro — الافتراضي", css: "" },
  { id: "cairo", label: "Cairo — عصري واضح", css: "var(--font-cairo), sans-serif" },
  { id: "tajawal", label: "Tajawal — بسيط", css: "var(--font-tajawal), sans-serif" },
  { id: "changa", label: "Changa — عريض", css: "var(--font-changa), sans-serif" },
  { id: "reemkufi", label: "Reem Kufi — كوفي", css: "var(--font-reemkufi), sans-serif" },
  { id: "amiri", label: "Amiri — نسخ تقليدي", css: "var(--font-amiri), serif" },
] as const;
export type SiteFontId = (typeof SITE_FONTS)[number]["id"];

export const BASE_SIZE_MIN = 14;
export const BASE_SIZE_MAX = 20;
export const BASE_SIZE_DEFAULT = 16;

export type Theme = {
  light: ColorSet;
  dark: ColorSet;
  /** خط النصوص عمومًا. */
  bodyFont: SiteFontId;
  /** خط العناوين؛ "same" = نفس خط النصوص. */
  headingFont: SiteFontId | "same";
  /** حجم الخط الأساسي بالبكسل (تتبعه كل أحجام rem في الموقع). */
  baseSize: number;
};

export const DEFAULT_THEME: Theme = {
  light: { ...EMPTY },
  dark: { ...EMPTY },
  bodyFont: "default",
  headingFont: "same",
  baseSize: BASE_SIZE_DEFAULT,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function cleanColors(v: unknown): ColorSet {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out = { ...EMPTY };
  for (const k of COLOR_KEYS) {
    const x = o[k];
    out[k] = typeof x === "string" && HEX.test(x) ? x.toLowerCase() : "";
  }
  return out;
}

/** ينظّف أي قيمة قادمة من Firestore أو من النموذج إلى Theme صالح. */
export function cleanTheme(v: unknown): Theme {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const size = Math.round(Number(o.baseSize));
  return {
    light: cleanColors(o.light),
    dark: cleanColors(o.dark),
    bodyFont: SITE_FONTS.some((f) => f.id === o.bodyFont) ? (o.bodyFont as SiteFontId) : "default",
    headingFont: o.headingFont === "same" || SITE_FONTS.some((f) => f.id === o.headingFont) ? (o.headingFont as Theme["headingFont"]) : "same",
    baseSize: Number.isFinite(size) && size > 0 ? Math.min(BASE_SIZE_MAX, Math.max(BASE_SIZE_MIN, size)) : BASE_SIZE_DEFAULT,
  };
}

// ---------- التباين (WCAG) ----------
function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
/** نسبة التباين بين لونين (1 إلى 21). الحد الأدنى المقبول للنص العادي 4.5. */
export function contrastRatio(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 1;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** يختار أبيض أو داكنًا، أيهما أوضح فوق اللون المعطى. */
export function bestInk(bg: string): string {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#0b1620") ? "#ffffff" : "#0b1620";
}

/** اللون الفعلي لكل مفتاح: المخصّص إن وُجد وإلا الافتراضي (مع حساب نص الأزرار تلقائيًا). */
export function effectiveColors(t: Theme, mode: "light" | "dark"): ColorSet {
  const base = DEFAULT_COLORS[mode];
  const set = t[mode];
  const out = { ...base };
  for (const k of COLOR_KEYS) if (set[k]) out[k] = set[k];
  if (set.accent && !set.accentInk) out.accentInk = bestInk(set.accent);
  return out;
}

function vars(t: Theme, mode: "light" | "dark"): string {
  const set = t[mode];
  const parts: string[] = [];
  const map: Record<ColorKey, string> = { bg: "--bg", surface: "--surface", ink: "--ink", mute: "--mute", line: "--line", accent: "--accent", accentInk: "--accent-ink" };
  for (const k of COLOR_KEYS) if (set[k]) parts.push(`${map[k]}:${set[k]}`);
  if (set.accent && !set.accentInk) parts.push(`--accent-ink:${bestInk(set.accent)}`);
  return parts.join(";");
}

/**
 * يولّد CSS الثيم. كل المدخلات منظَّفة (hex ثابت، معرّفات خطوط من قائمة)،
 * و`html:root` ترفع الأولوية فوق globals.css دون !important.
 */
export function themeCss(raw: Theme): string {
  const t = cleanTheme(raw);
  const out: string[] = [];
  const light = vars(t, "light");
  const dark = vars(t, "dark");
  if (light || t.baseSize !== BASE_SIZE_DEFAULT) {
    out.push(`html:root{${[light, t.baseSize !== BASE_SIZE_DEFAULT ? `font-size:${t.baseSize}px` : ""].filter(Boolean).join(";")}}`);
  }
  if (dark) out.push(`@media (prefers-color-scheme:dark){html:root{${dark}}}`);
  const body = SITE_FONTS.find((f) => f.id === t.bodyFont);
  if (body?.css) out.push(`html:root body{font-family:${body.css}}`);
  const headId = t.headingFont === "same" ? t.bodyFont : t.headingFont;
  const head = SITE_FONTS.find((f) => f.id === headId);
  if (head?.css) out.push(`html:root :is(h1,h2,h3,.page-title){font-family:${head.css}}`);
  return out.join("\n");
}

export const THEME_CACHE_KEY = "site-theme-css";
export const THEME_STYLE_ID = "site-theme";
