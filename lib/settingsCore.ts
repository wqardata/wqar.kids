// منطق الإعدادات النقي (بلا "use client") ليعمل في الخادم والمتصفح معًا.
import { CONTACT_EMAIL, LIVE_URL, MENU_ICONS, SITE_DESCRIPTION, SUPPORT_LINKS, more, nav, type IconName, type NavItem } from "./data";
import { IDENTITY } from "./identity";
import { DEFAULT_THEME, cleanTheme, type Theme } from "./theme";
import { DEFAULT_ADHAN, cleanAdhan, type AdhanSettings } from "./adhanCore";
import { ROW_ICON_IDS } from "./rowIcons";
import { DEFAULT_ADHKAR, cleanAdhkar, type AdhkarSettings } from "./adhkarCore";

/** خطوط اسم الموقع. تُحمَّل من layout.tsx ولا تُنزَّل إلا عند استعمالها. */
export const BRAND_FONTS = [
  { id: "default", label: "خط الموقع (Readex Pro)", css: "" },
  { id: "cairo", label: "Cairo — عصري واضح", css: "var(--font-cairo), sans-serif" },
  { id: "tajawal", label: "Tajawal — بسيط", css: "var(--font-tajawal), sans-serif" },
  { id: "changa", label: "Changa — عريض للعناوين", css: "var(--font-changa), sans-serif" },
  { id: "reemkufi", label: "Reem Kufi — كوفي", css: "var(--font-reemkufi), sans-serif" },
  { id: "amiri", label: "Amiri — نسخ تقليدي", css: "var(--font-amiri), serif" },
] as const;
export type BrandFontId = (typeof BRAND_FONTS)[number]["id"];
export const BRAND_SIZE_MIN = 16;
export const BRAND_SIZE_MAX = 32;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** تخصيص عنصر قائمة: الاسم والأيقونة (المفتاح هو مسار الصفحة مثل "/shorts"). */
export type NavOverride = { label: string; icon: IconName };
export type NavOverrides = Record<string, NavOverride>;

/** أزرار أسفل الفيديو: أزرار مدمجة (تُرتَّب وتُخفى فقط) وأزرار روابط يضيفها المشرف. */
export const WATCH_BUILTINS = [
  { id: "favorite", label: "المفضلة (عدّاد المعجبين)" },
  { id: "download", label: "تنزيل" },
  { id: "share", label: "مشاركة" },
  { id: "report", label: "إبلاغ" },
] as const;
export type WatchBuiltinId = (typeof WATCH_BUILTINS)[number]["id"];
export const WATCH_LINK_ICONS: readonly IconName[] = [...MENU_ICONS, "share", "link", "flag"];
export type WatchButton = { id: string; kind: "builtin" | "link"; label: string; icon: IconName; href: string; show: boolean };

const builtinButton = (id: WatchBuiltinId, show = true): WatchButton => ({ id, kind: "builtin", label: "", icon: "link", href: "", show });
export const DEFAULT_WATCH_BUTTONS: WatchButton[] = WATCH_BUILTINS.map((b) => builtinButton(b.id));

function cleanWatch(v: unknown): WatchButton[] {
  const out: WatchButton[] = [];
  const seen = new Set<string>();
  if (Array.isArray(v)) {
    for (const raw of v.slice(0, 24)) {
      const o = (raw ?? {}) as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id.slice(0, 40) : "";
      if (!id || seen.has(id)) continue;
      const show = o.show !== false;
      const builtin = WATCH_BUILTINS.find((b) => b.id === id);
      if (builtin) {
        out.push(builtinButton(builtin.id, show));
        seen.add(id);
      } else if (id.startsWith("link-")) {
        const label = typeof o.label === "string" ? o.label.trim().slice(0, 24) : "";
        const href = typeof o.href === "string" ? cleanUrl(o.href) : "";
        const icon = WATCH_LINK_ICONS.find((i) => i === o.icon) ?? "link";
        if (label && href) {
          out.push({ id, kind: "link", label, icon, href, show });
          seen.add(id);
        }
      }
    }
  }
  // أي زر مدمج غاب عن القائمة (مثل الإعدادات القديمة) يُضاف في آخرها.
  // زر «تنزيل» يوضع قبل «مشاركة» (على يمينها في الواجهة العربية)، وغيره في الآخر.
  for (const b of WATCH_BUILTINS) {
    if (seen.has(b.id)) continue;
    const at = b.id === "download" ? out.findIndex((x) => x.id === "share") : -1;
    if (at >= 0) out.splice(at, 0, builtinButton(b.id));
    else out.push(builtinButton(b.id));
  }
  return out;
}

/** أماكن نافذة التثبيت. start/end منطقيان: في الواجهة العربية start = اليمين. */
export const INSTALL_POS_DESKTOP = [
  { id: "bottom-end", label: "أسفل اليسار" },
  { id: "bottom-start", label: "أسفل اليمين" },
  { id: "bottom-center", label: "أسفل الوسط" },
  { id: "top-end", label: "أعلى اليسار" },
  { id: "top-start", label: "أعلى اليمين" },
  { id: "top-center", label: "أعلى الوسط" },
  { id: "center", label: "منتصف الشاشة" },
] as const;
export type InstallPosDesktop = (typeof INSTALL_POS_DESKTOP)[number]["id"];
export const INSTALL_POS_MOBILE = [
  { id: "bottom", label: "أسفل الشاشة (فوق شريط التنقل)" },
  { id: "top", label: "أعلى الشاشة (تحت الهيدر)" },
  { id: "center", label: "منتصف الشاشة" },
] as const;
export type InstallPosMobile = (typeof INSTALL_POS_MOBILE)[number]["id"];

/** إعدادات نافذة «ثبّت التطبيق». النصوص تقبل {name} فيُستبدل باسم الموقع. */
export type InstallSettings = {
  enabled: boolean;
  mobile: boolean;
  desktop: boolean;
  posMobile: InstallPosMobile;
  posDesktop: InstallPosDesktop;
  /** ثوانٍ قبل ظهور النافذة (0 = فورًا). */
  delaySec: number;
  /** أيام الإخفاء بعد إغلاقها (0 = تظهر في كل زيارة). */
  snoozeDays: number;
  /** تظهر في الصفحة الرئيسية فقط. */
  homeOnly: boolean;
  title: string;
  subtitle: string;
  button: string;
  /** رقم نسخة أيقونة التطبيق المرفوعة (0 = الأيقونة الافتراضية). الصور نفسها في settings/appicon. */
  appIconV: number;
  /** لون خلفية أيقونة التطبيق وشاشة فتحه (فارغ = لون الموقع الداكن). */
  appIconBg: string;
};

export const DEFAULT_INSTALL: InstallSettings = {
  enabled: true,
  mobile: true,
  desktop: true,
  posMobile: "bottom",
  posDesktop: "bottom-end",
  delaySec: 0,
  snoozeDays: 3,
  homeOnly: false,
  title: "ثبّت تطبيق {name}",
  subtitle: "وصول أسرع، وتفتح في نافذة مستقلة كأي برنامج",
  button: "تثبيت التطبيق",
  appIconV: 0,
  appIconBg: "",
};

function cleanInstall(v: unknown): InstallSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const D = DEFAULT_INSTALL;
  const text = (k: string, max: number, fb: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim().slice(0, max) : fb);
  const int = (k: string, lo: number, hi: number, fb: number) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fb;
  };
  return {
    enabled: o.enabled !== false,
    mobile: o.mobile !== false,
    desktop: o.desktop !== false,
    posMobile: INSTALL_POS_MOBILE.some((p) => p.id === o.posMobile) ? (o.posMobile as InstallPosMobile) : D.posMobile,
    posDesktop: INSTALL_POS_DESKTOP.some((p) => p.id === o.posDesktop) ? (o.posDesktop as InstallPosDesktop) : D.posDesktop,
    delaySec: int("delaySec", 0, 120, D.delaySec),
    snoozeDays: int("snoozeDays", 0, 90, D.snoozeDays),
    homeOnly: o.homeOnly === true,
    title: text("title", 60, D.title),
    subtitle: text("subtitle", 100, D.subtitle),
    button: text("button", 30, D.button),
    appIconV: int("appIconV", 0, Number.MAX_SAFE_INTEGER, 0),
    appIconBg: typeof o.appIconBg === "string" && HEX.test(o.appIconBg) ? o.appIconBg : "",
  };
}

/** نصوص صفحة التسجيل والدخول (/login) التي يعدّلها المشرف من تبويب «التسجيل». يقبل {name} = اسم الموقع. */
export type SignupTexts = {
  title: string;
  noteSignin: string;
  noteSignup: string;
  noteReset: string;
  google: string;
  or: string;
  nameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  submitSignin: string;
  submitSignup: string;
  submitReset: string;
  toSignup: string;
  toSignin: string;
  forgot: string;
  resetDone: string;
};

export const DEFAULT_SIGNUP: SignupTexts = {
  title: "تسجيل الدخول",
  noteSignin: "سجّل الدخول بحسابك. الحسابات الجديدة تُضاف من قِبل إدارة الموقع.",
  noteSignup: "أنشئ حسابًا مجانيًا للمشاهدة. رفع الفيديوهات وإدارة الموقع للمشرف فقط.",
  noteReset: "اكتب بريدك لنرسل لك رابط إعادة تعيين كلمة المرور.",
  google: "المتابعة باستخدام جوجل",
  or: "أو بالبريد الإلكتروني",
  nameLabel: "الاسم (اختياري)",
  emailLabel: "البريد الإلكتروني",
  passwordLabel: "كلمة المرور",
  submitSignin: "تسجيل الدخول",
  submitSignup: "إنشاء حساب",
  submitReset: "إرسال الرابط",
  toSignup: "ليس لديك حساب؟ أنشئ حسابًا",
  toSignin: "لديك حساب؟ سجّل الدخول",
  forgot: "نسيت كلمة المرور؟",
  resetDone: "إن كان البريد مسجّلًا فسيصلك رابط لإعادة تعيين كلمة المرور. تفقّد أيضًا البريد المزعج.",
};

/** حقول التعديل في تبويب «التسجيل»، مجمّعة بحسب مكانها في الصفحة. */
export const SIGNUP_FIELDS: { group: string; items: { key: keyof SignupTexts; label: string; max: number; long?: boolean }[] }[] = [
  { group: "العنوان والنصوص التعريفية", items: [
    { key: "title", label: "عنوان الصفحة", max: 80 },
    { key: "noteSignin", label: "نص تسجيل الدخول", max: 200, long: true },
    { key: "noteReset", label: "نص استعادة كلمة المرور", max: 200, long: true },
  ] },
  { group: "الحقول والأزرار", items: [
    { key: "google", label: "زر جوجل", max: 40 },
    { key: "or", label: "الفاصل فوق نموذج البريد", max: 40 },
    { key: "emailLabel", label: "عنوان خانة البريد", max: 40 },
    { key: "passwordLabel", label: "عنوان خانة كلمة المرور", max: 40 },
    { key: "submitSignin", label: "زر الدخول", max: 30 },
    { key: "submitReset", label: "زر إرسال رابط الاستعادة", max: 30 },
  ] },
  { group: "روابط التنقل والرسائل", items: [
    { key: "toSignin", label: "رابط «لديك حساب»", max: 60 },
    { key: "forgot", label: "رابط «نسيت كلمة المرور»", max: 60 },
    { key: "resetDone", label: "رسالة بعد إرسال رابط الاستعادة", max: 200, long: true },
  ] },
];

/** يعوّض {name} في نص التسجيل باسم الموقع. */
export function signupText(t: string, siteName: string): string {
  return t.replace(/\{name\}/g, siteName);
}

export function cleanSignup(v: unknown): SignupTexts {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_SIGNUP };
  for (const g of SIGNUP_FIELDS) {
    for (const f of g.items) {
      const x = o[f.key];
      if (typeof x === "string" && x.trim()) out[f.key] = x.trim().slice(0, f.max);
    }
  }
  // نصوص افتراضية قديمة (كانت تذكر إنشاء الحساب) صارت تُستبدل بالجديدة؛ التسجيل الذاتي أُلغي.
  if (out.title === "تسجيل الدخول أو إنشاء حساب") out.title = DEFAULT_SIGNUP.title;
  if (out.noteSignin === "سجّل الدخول، أو أنشئ حسابًا جديدًا للمشاهدة.") out.noteSignin = DEFAULT_SIGNUP.noteSignin;
  return out;
}

/** طرق الدخول الظاهرة في صفحة /login. يجب أن تبقى واحدة على الأقل. */
export type LoginMethods = { google: boolean; email: boolean };
export const DEFAULT_LOGIN_METHODS: LoginMethods = { google: true, email: true };
export function cleanLoginMethods(v: unknown): LoginMethods {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const m = { google: o.google !== false, email: o.email !== false };
  return m.google || m.email ? m : { ...DEFAULT_LOGIN_METHODS }; // لا يُسمح بإخفاء الطريقتين معًا
}

/** أصوات التنبيه (نغمات مولَّدة في المتصفح، بلا ملفات). */
export type SoundSettings = {
  /** عند وصول إشعار جديد. */
  notify: boolean;
  /** عند ظهور تنبيه «اقتربت صلاة …». */
  remind: boolean;
  /** عند ظهور نافذة الأذان (إن لم يكن هناك ملف تكبيرات؛ ملف التكبيرات له صوته). */
  adhan: boolean;
  /** مستوى الصوت 0..100. */
  volume: number;
};
export const DEFAULT_SOUNDS: SoundSettings = { notify: true, remind: true, adhan: true, volume: 70 };
export function cleanSounds(v: unknown): SoundSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const n = Number(o.volume);
  return {
    notify: o.notify !== false,
    remind: o.remind !== false,
    adhan: o.adhan !== false,
    volume: Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : DEFAULT_SOUNDS.volume,
  };
}

/** ترتيب فيديوهات الرئيسية: عشوائي، أو مرتّب (الجديد ثم الأكثر مشاهدة ثم البقية من الأحدث للأقدم). */
export const HOME_ORDERS = [
  { id: "random", label: "عشوائي (يتغيّر مع كل زيارة)" },
  { id: "ordered", label: "ترتيب ثابت (الجديد ثم الأكثر مشاهدة ثم البقية من الأحدث)" },
] as const;
export type HomeOrder = (typeof HOME_ORDERS)[number]["id"];

/** ترتيب فيديوهات صفحة المجموعة. */
export const GROUP_ORDERS = [
  { id: "newest", label: "من الأحدث إلى الأقدم" },
  { id: "oldest", label: "من الأقدم إلى الأحدث" },
  { id: "random", label: "عشوائي (يتغيّر مع كل زيارة)" },
] as const;
export type GroupOrder = (typeof GROUP_ORDERS)[number]["id"];

/** موضع صف المقاطع القصيرة: 0 = أعلى الصفحة، n = بعد الصف رقم n، SHORTS_POS_END = في النهاية. */
export const SHORTS_POS_END = 99;
export const SHORTS_POS_MAX_ROW = 10;

/** طريقة عرض صف «تابع المشاهدة»: شريط أفقي قابل للتمرير، أو صفوف شبكة. */
export const CONTINUE_LAYOUTS = [
  { id: "scroll", label: "شريط أفقي (تمرير يمينًا ويسارًا)" },
  { id: "rows", label: "صفوف (شبكة)" },
] as const;
export type ContinueLayout = (typeof CONTINUE_LAYOUTS)[number]["id"];
export const CONTINUE_COUNT_MAX = 12;
/** عرض مربع الفيديو في «تابع المشاهدة» (بكسل): الشريط الأفقي = عرض المربع، والصفوف = أقل عرض للمربع. */
export const CONTINUE_SIZE_MIN = 140;
export const CONTINUE_SIZE_MAX = 420;
export const CONTINUE_SIZE_DEFAULT = 280;
/** أقصى حد أدنى (بالثواني) لمدة المشاهدة كي يظهر الفيديو في صف «تابع المشاهدة». */
export const CONTINUE_MIN_SEC_MAX = 120;

/**
 * تبويبات أعلى الرئيسية. المعرّف: "all" (الكل) • "new" (الجديد) • "cat:<معرّف التصنيف>".
 * label = الاسم الظاهر (فارغ = الاسم الافتراضي: «الكل» / «الجديد» / اسم التصنيف).
 */
export type HomeTab = { id: string; label: string; /** نسخة من اسم التصنيف وقت الإضافة (احتياط إن لم يكن له فيديوهات ظاهرة). */ name: string };
export const HOME_TABS_MAX = 30;
const HOME_TAB_ID = /^(all|new|cat:[A-Za-z0-9_-]{1,60})$/;
export const HOME_TAB_DEFAULT_LABEL: Record<string, string> = { all: "الكل", new: "الجديد" };
export function cleanHomeTabs(v: unknown): HomeTab[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: HomeTab[] = [];
  for (const x of v) {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!HOME_TAB_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: typeof o.label === "string" ? o.label.trim().slice(0, 40) : "",
      name: typeof o.name === "string" ? o.name.trim().slice(0, 60) : "",
    });
    if (out.length >= HOME_TABS_MAX) break;
  }
  return out;
}

/** كم إشعارًا يظهر لكل زائر في قائمة الجرس (يُضبط من «الإشعارات» في لوحة التحكم). */
export const NOTICE_COUNT_MIN = 1;
export const NOTICE_COUNT_MAX = 20;
export const DEFAULT_NOTICE_COUNT = 5;
export function cleanNoticeCount(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(NOTICE_COUNT_MAX, Math.max(NOTICE_COUNT_MIN, n)) : DEFAULT_NOTICE_COUNT;
}

/** صفوف الرئيسية المخصّصة: لكل صف عدد فيديوهاته (الافتراضي 3 في الصف) ويمكن إضافة صفوف وحذفها. */
export const ROW_SIZE_MIN = 1;
export const ROW_SIZE_MAX = 6;
export const ROW_SIZE_DEFAULT = 3;
export const HOME_ROW_LIST_MAX = 30;
export const DEFAULT_ROW_SIZES: number[] = [3, 3, 3];
export function cleanRowSizes(v: unknown): number[] {
  if (!Array.isArray(v)) return [...DEFAULT_ROW_SIZES];
  const out: number[] = [];
  for (const x of v) {
    const n = Math.round(Number(x));
    out.push(Number.isFinite(n) ? Math.min(ROW_SIZE_MAX, Math.max(ROW_SIZE_MIN, n)) : ROW_SIZE_DEFAULT);
    if (out.length >= HOME_ROW_LIST_MAX) break;
  }
  return out.length > 0 ? out : [...DEFAULT_ROW_SIZES];
}

/** إعدادات العرض: الصفحة الرئيسية وصفحات المجموعات (تبويب «العرض» في إدارة المحتوى). */
export type DisplaySettings = {
  /** إجمالي صفوف الفيديوهات في الرئيسية (الصف = 4 فيديوهات على الحاسوب). 0 = كل الفيديوهات مع التحميل التدريجي. */
  homeRows: number;
  /** true = صفوف مخصّصة (عدد فيديوهات كل صف على حدة) وتتجاهل homeRows؛ false = الأسلوب القديم (4 في الصف). */
  homeRowsCustom: boolean;
  /** عدد الفيديوهات في كل صف مخصّص بالترتيب من الأعلى. */
  homeRowSizes: number[];
  /** بعد آخر صف مخصّص: true = تابع عرض بقية الفيديوهات (3 في الصف مع تحميل تدريجي)، false = توقّف عند آخر صف. */
  homeRowsMore: boolean;
  /** عنوان يسبق المجموعة الأولى من الصفوف (الجديد والأكثر مشاهدة). فارغ = بلا عنوان. */
  titleTop: string;
  /** عنوان يسبق بقية الصفوف. فارغ = بلا عنوان. */
  titleRest: string;
  /** عدد الفيديوهات الجديدة في المجموعة الأولى. */
  newCount: number;
  /** عدد الفيديوهات الأكثر مشاهدة في المجموعة الأولى. */
  popularCount: number;
  homeOrder: HomeOrder;
  /** إظهار صف المقاطع القصيرة في الرئيسية. */
  shortsShow: boolean;
  shortsPos: number;
  /** ترتيب الفيديوهات داخل صفحة المجموعة. */
  groupOrder: GroupOrder;
  /** صف «تابع المشاهدة»: آخر فيديوهات بدأ الزائر مشاهدتها ولم يُكمِلها (من سجل متصفحه). */
  continueShow: boolean;
  continueCount: number;
  continueLayout: ContinueLayout;
  continueTitle: string;
  /** حجم مربعات الفيديو في الصف (عرض المربع بالبكسل). */
  continueSize: number;
  /** أقل مدة مشاهدة (ثوانٍ) ليظهر الفيديو في «تابع المشاهدة». 0 = أي فيديو سبق فتحه ولم يكتمل. */
  continueMinSec: number;
  /** تخصيص تبويبات أعلى الرئيسية يدويًا (false = تلقائي: الكل والجديد وكل التصنيفات). */
  homeTabsCustom: boolean;
  homeTabs: HomeTab[];
  /** إظهار إجمالي مدة حلقات المجموعة على بطاقتها في «مجموعاتي». */
  seriesShowDuration: boolean;
  /** عنوان صف المقاطع القصيرة. */
  shortsTitle: string;
  /** أيقونات عناوين الصفوف (معرّف من lib/rowIcons.ts؛ فارغ = بلا أيقونة). */
  iconContinue: string;
  iconTop: string;
  iconRest: string;
  iconShorts: string;
};

export const DEFAULT_DISPLAY: DisplaySettings = {
  homeRows: 0,
  homeRowsCustom: true,
  homeRowSizes: [...DEFAULT_ROW_SIZES],
  homeRowsMore: true,
  titleTop: "",
  titleRest: "",
  newCount: 3,
  popularCount: 2,
  homeOrder: "random",
  shortsShow: true,
  shortsPos: 2,
  groupOrder: "random",
  continueShow: true,
  continueCount: 2,
  continueLayout: "scroll",
  continueTitle: "تابع المشاهدة",
  continueSize: CONTINUE_SIZE_DEFAULT,
  continueMinSec: 0,
  homeTabsCustom: false,
  homeTabs: [],
  seriesShowDuration: true,
  shortsTitle: "مقاطع قصيرة",
  iconContinue: "",
  iconTop: "",
  iconRest: "",
  iconShorts: "",
};

export const DISPLAY_COUNT_MAX = 40;
export const DISPLAY_ROWS_MAX = 100;

export function cleanDisplay(v: unknown): DisplaySettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const D = DEFAULT_DISPLAY;
  const int = (k: string, lo: number, hi: number, fb: number) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fb;
  };
  const text = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, 60) : "");
  // النص غير الموجود يأخذ الافتراضي، أما الفارغ عمدًا فيبقى فارغًا (بلا عنوان).
  const textOr = (k: string, fb: string) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, 60) : fb);
  const icon = (k: string) => (typeof o[k] === "string" && ROW_ICON_IDS.has(o[k] as string) ? (o[k] as string) : "");
  const pos = int("shortsPos", 0, SHORTS_POS_END, D.shortsPos);
  return {
    homeRows: int("homeRows", 0, DISPLAY_ROWS_MAX, D.homeRows),
    // إعدادات قديمة محفوظة بعدد صفوف محدّد تبقى على الأسلوب القديم حتى يفعّل المشرف الصفوف المخصّصة.
    homeRowsCustom: typeof o.homeRowsCustom === "boolean" ? o.homeRowsCustom : !(Number(o.homeRows) > 0),
    homeRowSizes: cleanRowSizes(o.homeRowSizes),
    homeRowsMore: o.homeRowsMore !== false,
    titleTop: text("titleTop"),
    titleRest: text("titleRest"),
    newCount: int("newCount", 0, DISPLAY_COUNT_MAX, D.newCount),
    popularCount: int("popularCount", 0, DISPLAY_COUNT_MAX, D.popularCount),
    homeOrder: HOME_ORDERS.some((x) => x.id === o.homeOrder) ? (o.homeOrder as HomeOrder) : D.homeOrder,
    shortsShow: o.shortsShow !== false,
    shortsPos: pos > SHORTS_POS_MAX_ROW ? SHORTS_POS_END : pos,
    groupOrder: GROUP_ORDERS.some((x) => x.id === o.groupOrder) ? (o.groupOrder as GroupOrder) : D.groupOrder,
    continueShow: o.continueShow !== false,
    continueCount: int("continueCount", 1, CONTINUE_COUNT_MAX, D.continueCount),
    continueLayout: CONTINUE_LAYOUTS.some((x) => x.id === o.continueLayout) ? (o.continueLayout as ContinueLayout) : D.continueLayout,
    continueTitle: textOr("continueTitle", D.continueTitle),
    continueSize: int("continueSize", CONTINUE_SIZE_MIN, CONTINUE_SIZE_MAX, D.continueSize),
    continueMinSec: int("continueMinSec", 0, CONTINUE_MIN_SEC_MAX, D.continueMinSec),
    homeTabsCustom: o.homeTabsCustom === true,
    homeTabs: cleanHomeTabs(o.homeTabs),
    seriesShowDuration: o.seriesShowDuration !== false,
    shortsTitle: textOr("shortsTitle", D.shortsTitle),
    iconContinue: icon("iconContinue"),
    iconTop: icon("iconTop"),
    iconRest: icon("iconRest"),
    iconShorts: icon("iconShorts"),
  };
}

/** ───────── صفحة الفيديو: الفيديوهات المقترحة ───────── */
export const SUG_LAYOUTS = [
  { id: "list", label: "قائمة (صورة صغيرة بجانب النص)" },
  { id: "cards", label: "بطاقات (صورة كبيرة فوق النص)" },
  { id: "scroll", label: "شريط أفقي (تمرير يمينًا ويسارًا)" },
] as const;
export type SugLayout = (typeof SUG_LAYOUTS)[number]["id"];

export const SUG_ORDERS = [
  { id: "mix", label: "الأقرب للفيديو الحالي أولًا ثم عشوائي" },
  { id: "related", label: "الأقرب للفيديو الحالي فقط (مرتّبة بالصلة ثم الأحدث)" },
  { id: "newest", label: "الأحدث أولًا" },
  { id: "popular", label: "الأكثر مشاهدة أولًا" },
  { id: "random", label: "عشوائي بالكامل" },
] as const;
export type SugOrder = (typeof SUG_ORDERS)[number]["id"];

export const SUG_SCOPES = [
  { id: "all", label: "كل الفيديوهات" },
  { id: "series", label: "من نفس المجموعة فقط" },
  { id: "category", label: "من نفس التصنيف فقط" },
] as const;
export type SugScope = (typeof SUG_SCOPES)[number]["id"];

export const SUG_COUNT_MAX = 30;

/** حجم واجهة مشغّل درايف على الجوال بالنسبة المئوية (100 = حجم درايف الأصلي، أقل = أزرار أصغر). */
export const DRIVE_BTN_SCALE_MIN = 30;
export const DRIVE_BTN_SCALE_MAX = 150;

/** حجم زر التشغيل/الإيقاف الأوسط في مشغّل يوتيوب بالنسبة المئوية (100 = الحجم الأصلي 68px). */
export const PLAY_BTN_SCALE_MIN = 40;
export const PLAY_BTN_SCALE_MAX = 180;

export type WatchPageSettings = {
  /** حجم أزرار مشغّل درايف على الجوال (%). */
  driveBtnScale: number;
  /** حجم زر التشغيل/الإيقاف الأوسط (%). */
  playBtnScale: number;
  /** تشغيل فيديوهات يوتيوب بلا صوت افتراضيًا (الزائر يستطيع تشغيل الصوت من زر الصوت). */
  ytMuted: boolean;
  /** اختيار المسار الصوتي «بدون موسيقى» تلقائيًا إن كان الفيديو يوفّره. */
  ytNoMusic: boolean;
  /** إظهار قسم الفيديوهات المقترحة. */
  sugShow: boolean;
  /** عنوان القسم (فارغ = بلا عنوان). */
  sugTitle: string;
  sugCount: number;
  sugLayout: SugLayout;
  sugOrder: SugOrder;
  /** من أين تُؤخذ الفيديوهات: الكل، أو نفس مجموعة/تصنيف الفيديو المشغَّل فقط (إن لم يوجد شيء تُستعمل البقية). */
  sugScope: SugScope;
  /** في وضع «الأقرب ثم عشوائي»: كم فيديو من الأقرب يأتي أولًا (الباقي عشوائي). */
  sugRelated: number;
  /** أولوية الصلة: نفس المجموعة / نفس التصنيف. */
  sugPrioSeries: boolean;
  sugPrioCategory: boolean;
  /** الحلقة التالية من نفس المجموعة تأتي أولًا. */
  sugNextFirst: boolean;
  /** إخفاء ما أكمله الزائر مشاهدته. */
  sugHideWatched: boolean;
  /** تضمين المقاطع القصيرة. */
  sugShorts: boolean;
  /** ما يظهر على كل فيديو مقترح. */
  sugShowSeries: boolean;
  sugShowEpisode: boolean;
  sugShowViews: boolean;
  sugShowDuration: boolean;
};

export const DEFAULT_WATCH_PAGE: WatchPageSettings = {
  driveBtnScale: 80,
  playBtnScale: 100,
  ytMuted: false,
  ytNoMusic: true,
  sugShow: true,
  sugTitle: "فيديوهات مقترحة",
  sugCount: 10,
  sugLayout: "list",
  sugOrder: "mix",
  sugScope: "all",
  sugRelated: 4,
  sugPrioSeries: true,
  sugPrioCategory: true,
  sugNextFirst: false,
  sugHideWatched: false,
  sugShorts: false,
  sugShowSeries: true,
  sugShowEpisode: false,
  sugShowViews: true,
  sugShowDuration: true,
};

export function cleanWatchPage(v: unknown): WatchPageSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const D = DEFAULT_WATCH_PAGE;
  const int = (k: string, lo: number, hi: number, fb: number) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fb;
  };
  const flag = (k: keyof WatchPageSettings, fb: boolean) => (typeof o[k] === "boolean" ? (o[k] as boolean) : fb);
  const count = int("sugCount", 1, SUG_COUNT_MAX, D.sugCount);
  return {
    driveBtnScale: int("driveBtnScale", DRIVE_BTN_SCALE_MIN, DRIVE_BTN_SCALE_MAX, D.driveBtnScale),
    playBtnScale: int("playBtnScale", PLAY_BTN_SCALE_MIN, PLAY_BTN_SCALE_MAX, D.playBtnScale),
    ytMuted: flag("ytMuted", D.ytMuted),
    ytNoMusic: flag("ytNoMusic", D.ytNoMusic),
    sugShow: flag("sugShow", D.sugShow),
    sugTitle: typeof o.sugTitle === "string" ? o.sugTitle.trim().slice(0, 60) : D.sugTitle,
    sugCount: count,
    sugLayout: SUG_LAYOUTS.some((x) => x.id === o.sugLayout) ? (o.sugLayout as SugLayout) : D.sugLayout,
    sugOrder: SUG_ORDERS.some((x) => x.id === o.sugOrder) ? (o.sugOrder as SugOrder) : D.sugOrder,
    sugScope: SUG_SCOPES.some((x) => x.id === o.sugScope) ? (o.sugScope as SugScope) : D.sugScope,
    sugRelated: Math.min(count, int("sugRelated", 0, SUG_COUNT_MAX, D.sugRelated)),
    sugPrioSeries: flag("sugPrioSeries", D.sugPrioSeries),
    sugPrioCategory: flag("sugPrioCategory", D.sugPrioCategory),
    sugNextFirst: flag("sugNextFirst", D.sugNextFirst),
    sugHideWatched: flag("sugHideWatched", D.sugHideWatched),
    sugShorts: flag("sugShorts", D.sugShorts),
    sugShowSeries: flag("sugShowSeries", D.sugShowSeries),
    sugShowEpisode: flag("sugShowEpisode", D.sugShowEpisode),
    sugShowViews: flag("sugShowViews", D.sugShowViews),
    sugShowDuration: flag("sugShowDuration", D.sugShowDuration),
  };
}

export type SupportLink = { label: string; href: string };
export type SiteSettings = {
  /** اسم الموقع كما يظهر داخل الصفحات (الهيدر، الدعم…). */
  siteName: string;
  /** الاسم الذي يظهر في تبويب المتصفح وعند تثبيت الموقع (فارغ = نفس اسم الموقع). */
  tabName: string;
  siteDescription: string;
  contactEmail: string;
  liveUrl: string;
  supportLinks: SupportLink[];
  /** الشعار كصورة data: صغيرة محفوظة داخل Firestore (فارغ = بلا شعار). */
  logo: string;
  logoHeight: number;
  showName: boolean;
  /** لون الاسم في الوضعين الفاتح والداكن (فارغ = لون الموقع الافتراضي). */
  brandColor: string;
  brandColorDark: string;
  brandSize: number;
  brandFont: BrandFontId;
  /** ألوان الموقع والخطوط والحجم الأساسي. */
  theme: Theme;
  /** أسماء وأيقونات القائمة المخصّصة (فارغ = الافتراضي). */
  navItems: NavOverrides;
  /** مسارات عناصر القائمة المخفية (تبقى الصفحات تعمل برابطها المباشر). */
  navHidden: string[];
  /** ترتيب القائمة وتوزيعها بين القسمين (فارغ = الترتيب الافتراضي). المفاتيح مسارات الصفحات. */
  navLayout: NavLayout;
  /** أزرار أسفل مشغّل الفيديو بترتيبها. */
  watchButtons: WatchButton[];
  /** شاشة الشعار عند فتح الموقع (تفعيل). */
  splash: boolean;
  /** تفاصيل شاشة الشعار: الصورة والحجم وطريقة الظهور والحركة والزمن. */
  splashCfg: SplashCfg;
  /** تشغيل الفيديو تلقائيًا عند فتح صفحته (قدر ما يسمح المتصفح والمشغّل). */
  autoplay: boolean;
  /** نافذة تثبيت التطبيق على الهاتف والكمبيوتر. */
  install: InstallSettings;
  /** نافذة الأذان في أوقات الصلوات. */
  adhan: AdhanSettings;
  /** أذكار الصباح والمساء (إشعار منبثق وقارئ بملء الشاشة). */
  adhkar: AdhkarSettings;
  /** قوة زجاجية الترويسة والنوافذ: 0 = معتمة تمامًا، 100 = أقصى شفافية وتمويه. */
  glass: number;
  /** نصوص صفحة التسجيل والدخول. */
  signup: SignupTexts;
  /** طرق الدخول الظاهرة: جوجل و/أو البريد وكلمة المرور. */
  loginMethods: LoginMethods;
  /** أصوات التنبيه للإشعارات والأذان. */
  sounds: SoundSettings;
  /** إعدادات عرض الرئيسية والمجموعات. */
  display: DisplaySettings;
  /** إعدادات صفحة الفيديو (الفيديوهات المقترحة). */
  watchPage: WatchPageSettings;
  /** عدد الإشعارات الظاهرة في قائمة الجرس. */
  noticeCount: number;
};

/** شاشة الشعار عند فتح الموقع. */
export const SPLASH_IN = [
  { id: "fade", label: "ظهور تدريجي" },
  { id: "zoom", label: "تكبير من الصغر" },
  { id: "up", label: "صعود من الأسفل" },
  { id: "down", label: "نزول من الأعلى" },
  { id: "bounce", label: "ارتداد" },
  { id: "blur", label: "من الضبابية إلى الوضوح" },
] as const;
export const SPLASH_MOTION = [
  { id: "none", label: "ثابت" },
  { id: "pulse", label: "نبض" },
  { id: "float", label: "طفو" },
  { id: "glow", label: "توهّج" },
  { id: "spin", label: "دوران بطيء" },
] as const;
export const SPLASH_OUT = [
  { id: "fade", label: "تلاشٍ" },
  { id: "zoom", label: "تكبير ثم تلاشٍ" },
  { id: "up", label: "صعود ثم تلاشٍ" },
  { id: "none", label: "اختفاء فوري" },
] as const;
export type SplashIn = (typeof SPLASH_IN)[number]["id"];
export type SplashMotion = (typeof SPLASH_MOTION)[number]["id"];
export type SplashOut = (typeof SPLASH_OUT)[number]["id"];
export const SPLASH_SIZE_MIN = 40;
export const SPLASH_SIZE_MAX = 360;
export const SPLASH_DUR_MIN = 1;
export const SPLASH_DUR_MAX = 8;
export type SplashCfg = {
  /** صورة خاصة بالشاشة (data:). فارغة = شعار الموقع. */
  image: string;
  /** ارتفاع الصورة بالبكسل. */
  size: number;
  anim: SplashIn;
  motion: SplashMotion;
  out: SplashOut;
  /** مدة بقاء الشاشة بالثواني قبل أن تختفي. */
  duration: number;
  /** لون الخلفية (فارغ = لون خلفية الموقع). */
  bg: string;
  /** إظهار اسم الموقع تحت الصورة. */
  showName: boolean;
};
export const DEFAULT_SPLASH: SplashCfg = { image: "", size: 80, anim: "zoom", motion: "none", out: "fade", duration: 1.3, bg: "", showName: false };

function cleanSplash(v: unknown): SplashCfg {
  const o = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const num = (x: unknown, lo: number, hi: number, def: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : def);
  const D = DEFAULT_SPLASH;
  return {
    image: cleanLogo(o.image),
    size: Math.round(num(o.size, SPLASH_SIZE_MIN, SPLASH_SIZE_MAX, D.size)),
    anim: SPLASH_IN.some((x) => x.id === o.anim) ? (o.anim as SplashIn) : D.anim,
    motion: SPLASH_MOTION.some((x) => x.id === o.motion) ? (o.motion as SplashMotion) : D.motion,
    out: SPLASH_OUT.some((x) => x.id === o.out) ? (o.out as SplashOut) : D.out,
    duration: Math.round(num(o.duration, SPLASH_DUR_MIN, SPLASH_DUR_MAX, D.duration) * 10) / 10,
    bg: typeof o.bg === "string" && HEX.test(o.bg) ? o.bg : "",
    showName: o.showName === true,
  };
}

/** القيم الافتراضية (من lib/data.ts) تُستخدم حتى تُحفظ إعدادات في Firestore. */
export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: IDENTITY.siteName,
  tabName: IDENTITY.tabName,
  siteDescription: SITE_DESCRIPTION,
  contactEmail: CONTACT_EMAIL,
  liveUrl: LIVE_URL,
  supportLinks: SUPPORT_LINKS.map((l) => ({ ...l })),
  logo: IDENTITY.logo,
  logoHeight: IDENTITY.logoHeight,
  showName: IDENTITY.showName,
  brandColor: "",
  brandColorDark: "",
  brandSize: 22,
  brandFont: "default",
  theme: DEFAULT_THEME,
  navItems: {},
  navHidden: [],
  navLayout: { main: [], more: [] },
  watchButtons: DEFAULT_WATCH_BUTTONS,
  splash: true,
  splashCfg: DEFAULT_SPLASH,
  autoplay: true,
  install: DEFAULT_INSTALL,
  adhan: DEFAULT_ADHAN,
  adhkar: DEFAULT_ADHKAR,
  glass: 60,
  signup: DEFAULT_SIGNUP,
  loginMethods: DEFAULT_LOGIN_METHODS,
  sounds: DEFAULT_SOUNDS,
  display: DEFAULT_DISPLAY,
  watchPage: DEFAULT_WATCH_PAGE,
  noticeCount: DEFAULT_NOTICE_COUNT,
};

export const GLASS_MIN = 0;
export const GLASS_MAX = 100;

/** يحوّل قوة الزجاجية (0–100) إلى متغيرات CSS تستعملها الترويسة والقوائم والنوافذ (انظر globals.css). */
export function glassCss(level: number): string {
  const g = Math.min(GLASS_MAX, Math.max(GLASS_MIN, Math.round(Number.isFinite(level) ? level : DEFAULT_SETTINGS.glass)));
  const a = Math.round(100 - g * 0.8); // نسبة لون الخلفية المتبقية: 100% (معتم) ← 20% (شفاف)
  const a2 = Math.min(100, a + 8); // القوائم والنوافذ أكثر كثافة قليلًا كي يبقى نصها واضحًا
  const b = Math.round(g * 0.32); // التمويه بالبكسل: 0 ← 32
  const sat = 100 + Math.round(g * 0.8); // تشبّع الألوان خلف الزجاج: 100% ← 180%
  return `html:root{--glass-a:${a}%;--glass-a2:${a2}%;--glass-b:${b}px;--glass-s:${sat}%}`;
}

export const LOGO_MIN = 20;
export const LOGO_MAX = 44;
const LOGO_RE = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;

function cleanLogo(v: unknown): string {
  return typeof v === "string" && v.length <= 300_000 && LOGO_RE.test(v) ? v : "";
}


/** يقبل روابط http/https فقط (يمنع javascript: وغيره). */
export function cleanUrl(s: string): string {
  const t = s.trim();
  if (!t) return "";
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function cleanNav(v: unknown): NavOverrides {
  const out: NavOverrides = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [href, raw] of Object.entries(v as Record<string, unknown>)) {
    const o = (raw ?? {}) as { label?: unknown; icon?: unknown };
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 24) : "";
    const icon = MENU_ICONS.find((i) => i === o.icon);
    if (href.startsWith("/") && href.length <= 40 && label && icon) out[href] = { label, icon };
  }
  return out;
}

/** عناصر القائمة التي لا تُخفى (كي لا تبقى القائمة فارغة). */
export const NAV_ALWAYS_SHOWN: readonly string[] = ["/"];

function cleanHidden(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out = v.filter((h): h is string => typeof h === "string" && h.startsWith("/") && h.length <= 40 && !NAV_ALWAYS_SHOWN.includes(h));
  return Array.from(new Set(out)).slice(0, 40);
}

/** توزيع عناصر القائمة: القسم الأول (الرئيسية + الشريط السفلي) والقسم الثاني (المزيد). */
export type NavLayout = { main: string[]; more: string[] };
/** أقصى عدد عناصر في القسم الأول (يظهر أيضًا في الشريط السفلي للجوال). */
export const NAV_MAIN_MAX = 7;
const ALL_NAV: readonly NavItem[] = [...nav, ...more];

function cleanLayout(v: unknown): NavLayout {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const known = new Set(ALL_NAV.map((n) => n.href));
  const seen = new Set<string>();
  const pick = (a: unknown): string[] => {
    const out: string[] = [];
    if (Array.isArray(a)) {
      for (const h of a) {
        if (typeof h === "string" && known.has(h) && !seen.has(h)) {
          seen.add(h);
          out.push(h);
        }
      }
    }
    return out;
  };
  const main = pick(o.main);
  let mo = pick(o.more);
  if (!main.length && !mo.length) return { main: [], more: [] };
  // الرئيسية تبقى دائمًا في القسم الأول.
  if (!main.includes("/")) {
    mo = mo.filter((h) => h !== "/");
    main.unshift("/");
    seen.add("/");
  }
  // أي صفحة غابت عن الإعداد (مثلًا أُضيفت لاحقًا) تعود لقسمها الافتراضي.
  for (const n of nav) if (!seen.has(n.href)) main.push(n.href);
  for (const n of more) if (!seen.has(n.href)) mo.push(n.href);
  return { main, more: mo };
}

/** يطبّق التوزيع المحفوظ على عناصر القائمة (الأسماء والأيقونات المخصّصة تُطبَّق بعدها). */
export function resolveNav(layout: NavLayout): { main: NavItem[]; more: NavItem[] } {
  if (!layout.main.length && !layout.more.length) return { main: [...nav], more: [...more] };
  const by = new Map(ALL_NAV.map((n) => [n.href, n] as const));
  const list = (hs: string[]) => hs.map((h) => by.get(h)).filter((n): n is NavItem => Boolean(n));
  return { main: list(layout.main), more: list(layout.more) };
}

export function merge(d: Record<string, unknown>): SiteSettings {
  const str = (k: string, fallback: string) => (typeof d[k] === "string" ? (d[k] as string) : fallback);
  const links = Array.isArray(d.supportLinks)
    ? (d.supportLinks as unknown[])
        .map((x) => {
          const o = x as { label?: unknown; href?: unknown };
          return { label: typeof o?.label === "string" ? o.label : "", href: typeof o?.href === "string" ? cleanUrl(o.href) : "" };
        })
        .filter((l) => l.label && l.href)
    : DEFAULT_SETTINGS.supportLinks;
  return {
    siteName: str("siteName", DEFAULT_SETTINGS.siteName).trim() || DEFAULT_SETTINGS.siteName,
    tabName: str("tabName", DEFAULT_SETTINGS.tabName).trim().slice(0, 60),
    siteDescription: str("siteDescription", DEFAULT_SETTINGS.siteDescription),
    contactEmail: str("contactEmail", DEFAULT_SETTINGS.contactEmail).trim(),
    liveUrl: cleanUrl(str("liveUrl", DEFAULT_SETTINGS.liveUrl)),
    supportLinks: links,
    logo: d.logo === undefined ? DEFAULT_SETTINGS.logo : cleanLogo(d.logo),
    logoHeight: Math.min(LOGO_MAX, Math.max(LOGO_MIN, Math.round(Number(d.logoHeight) || DEFAULT_SETTINGS.logoHeight))),
    showName: d.showName === undefined ? DEFAULT_SETTINGS.showName : d.showName !== false,
    brandColor: typeof d.brandColor === "string" && HEX.test(d.brandColor) ? d.brandColor : "",
    brandColorDark: typeof d.brandColorDark === "string" && HEX.test(d.brandColorDark) ? d.brandColorDark : "",
    brandSize: Math.min(BRAND_SIZE_MAX, Math.max(BRAND_SIZE_MIN, Math.round(Number(d.brandSize) || DEFAULT_SETTINGS.brandSize))),
    brandFont: BRAND_FONTS.some((f) => f.id === d.brandFont) ? (d.brandFont as BrandFontId) : "default",
    theme: cleanTheme(d.theme),
    navItems: cleanNav(d.navItems),
    navHidden: cleanHidden(d.navHidden),
    navLayout: cleanLayout(d.navLayout),
    watchButtons: cleanWatch(d.watchButtons),
    splash: d.splash !== false,
    splashCfg: cleanSplash(d.splashCfg),
    autoplay: d.autoplay !== false,
    install: cleanInstall(d.install),
    adhan: cleanAdhan(d.adhan),
    adhkar: cleanAdhkar(d.adhkar),
    glass: typeof d.glass === "number" && Number.isFinite(d.glass) ? Math.min(GLASS_MAX, Math.max(GLASS_MIN, Math.round(d.glass))) : DEFAULT_SETTINGS.glass,
    signup: cleanSignup(d.signup),
    loginMethods: cleanLoginMethods(d.loginMethods),
    sounds: cleanSounds(d.sounds),
    display: cleanDisplay(d.display),
    watchPage: cleanWatchPage(d.watchPage),
    noticeCount: cleanNoticeCount(d.noticeCount ?? DEFAULT_NOTICE_COUNT),
  };
}

