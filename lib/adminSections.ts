import { SIGNUP_FIELDS } from "./settingsCore";

/**
 * سجل «مربعات الإعدادات» القابلة للنقل بين تبويبات لوحة التحكم.
 * كل قسم له تبويب أصلي (home) ومكوّن مالك (owner) تعيش فيه حالته ويُسجَّل حفظه في شريط الحفظ الموحّد؛ النقل يغيّر مكان العرض فقط.
 */
export type BuiltinTabId =
  | "stats" | "settings" | "signup" | "appearance" | "menu" | "watch" | "display"
  | "adhan" | "adhkar" | "notifications" | "members" | "videos" | "shorts" | "categories" | "series";

/** معرّف التبويب: الأصلية أعلاه، وما ينشئه المشرف يأخذ معرّفًا مولَّدًا (t_…). */
export type TabId = string;

export type OwnerId =
  | "stats" | "reports" | "settings" | "signup" | "appearance" | "behavior" | "menu" | "watchButtons" | "suggested"
  | "display" | "adhan" | "adhkar" | "notifications" | "members" | "videos" | "shorts" | "categories" | "series";

export type SectionDef = {
  id: string;
  label: string;
  home: BuiltinTabId;
  owner: OwnerId;
  /** الصفحة المعروضة في المعاينة الحيّة عند وجود هذا القسم في التبويب ("@video" = أي فيديو). غير موجودة = لا معاينة. */
  preview?: string;
  ownerOnly?: boolean;
};

/** اسم مالك القسم كما يظهر فوق زر الحفظ حين يُعرض بعيدًا عن تبويبه الأصلي. */
export const OWNER_LABELS: Record<OwnerId, string> = {
  stats: "الإحصائيات",
  reports: "البلاغات",
  settings: "إعدادات الموقع",
  signup: "التسجيل",
  appearance: "المظهر",
  behavior: "تشغيل الفيديو",
  menu: "القوائم",
  watchButtons: "أزرار صفحة الفيديو",
  suggested: "الفيديوهات المقترحة",
  display: "العرض",
  adhan: "إعدادات الأذان",
  adhkar: "إعدادات الأذكار",
  notifications: "الإشعارات",
  members: "الأعضاء",
  videos: "الفيديوهات",
  shorts: "المقاطع القصيرة",
  categories: "التصنيفات",
  series: "المجموعات",
};

const S = (id: string, label: string, home: BuiltinTabId, owner: OwnerId, preview?: string, extra?: Partial<SectionDef>): SectionDef => ({ id, label, home, owner, preview, ...extra });

/** الترتيب هنا هو الترتيب الافتراضي داخل كل تبويب. */
export const SECTIONS: SectionDef[] = [
  S("stats.tiles", "مربعات الإحصاء", "stats", "stats"),
  S("stats.chart", "مخطط الإقبال", "stats", "stats"),
  S("reports", "البلاغات", "stats", "reports"),

  S("settings.info", "معلومات الموقع", "settings", "settings", "/"),
  S("settings.logo", "الشعار", "settings", "settings", "/"),
  S("settings.look", "مظهر اسم الموقع", "settings", "settings", "/"),
  S("settings.glass", "الزجاجية", "settings", "settings", "/"),
  S("settings.pages", "الصفحات وروابط الدعم", "settings", "settings", "/"),
  S("settings.app", "نافذة التطبيق", "settings", "settings", "/"),

  S("signup.texts", "نصوص صفحة التسجيل (تمهيد)", "signup", "signup", "/login"),
  S("signup.methods", "طرق الدخول الظاهرة", "signup", "signup", "/login"),
  ...SIGNUP_FIELDS.map((g, i) => S(`signup.g${i}`, g.group, "signup", "signup", "/login")),
  S("signup.preview", "معاينة صفحة الدخول قبل الحفظ", "signup", "signup", "/login"),

  S("appearance.presets", "ألوان جاهزة ومعاينة", "appearance", "appearance", "/"),
  S("appearance.light", "ألوان الوضع الفاتح", "appearance", "appearance", "/"),
  S("appearance.dark", "ألوان الوضع الداكن", "appearance", "appearance", "/"),
  S("appearance.fonts", "الخطوط والحجم", "appearance", "appearance", "/"),
  S("appearance.splash", "شاشة الشعار عند فتح الموقع", "appearance", "appearance", "/"),
  S("behavior.play", "تشغيل الفيديو", "appearance", "behavior", "@video"),

  S("menu.nav", "عناصر القوائم", "menu", "menu", "/"),

  S("watch.buttons", "أزرار صفحة الفيديو", "watch", "watchButtons", "@video"),
  S("watch.suggested", "الفيديوهات المقترحة", "watch", "suggested", "@video"),

  S("display.tabs", "التبويبات أعلى الصفحة الرئيسية", "display", "display", "/"),
  S("display.cont", "صف «تابع المشاهدة»", "display", "display", "/"),
  S("display.rows", "صفوف الفيديوهات", "display", "display", "/"),
  S("display.mobile", "عرض الجوال في الرئيسية", "display", "display", "/"),
  S("display.shorts", "صف المقاطع القصيرة", "display", "display", "/"),
  S("display.groups", "المجموعات", "display", "display", "/subscriptions"),

  S("adhan.main", "تفعيل نافذة الأذان", "adhan", "adhan", "/preview/adhan"),
  S("adhan.loc", "الموقع وطريقة الحساب", "adhan", "adhan", "/preview/adhan"),
  S("adhan.prayers", "الصلوات", "adhan", "adhan", "/preview/adhan"),
  S("adhan.remind", "التنبيه قبل الأذان", "adhan", "adhan", "/preview/adhan"),
  S("adhan.window", "النافذة والنص والعدّاد", "adhan", "adhan", "/preview/adhan"),
  S("adhan.parent", "خيارات «توجيه الوالدين»", "adhan", "adhan", "/preview/adhan"),
  S("adhan.takbir", "صوت التكبيرات", "adhan", "adhan", "/preview/adhan"),
  S("sound.adhan", "أصوات التنبيه (في الأذان)", "adhan", "adhan", "/preview/adhan"),

  S("adhkar.main", "تفعيل الأذكار", "adhkar", "adhkar", "/preview/adhkar"),
  S("adhkar.list", "قوائم الأذكار", "adhkar", "adhkar", "/preview/adhkar"),
  S("adhkar.preview", "معاينة الأذكار", "adhkar", "adhkar", "/preview/adhkar"),

  S("notif.send", "إرسال إشعار", "notifications", "notifications", "/"),
  S("notif.count", "عرض الإشعارات (العدد)", "notifications", "notifications", "/"),
  S("notif.sound", "أصوات التنبيه (في الإشعارات)", "notifications", "notifications", "/"),
  S("notif.sent", "الإشعارات المرسلة", "notifications", "notifications", "/"),

  S("members", "الأعضاء", "members", "members", "/", { ownerOnly: true }),
  S("videos", "قائمة الفيديوهات", "videos", "videos", "/"),
  S("shorts", "قائمة المقاطع القصيرة", "shorts", "shorts", "/shorts"),
  S("categories", "التصنيفات", "categories", "categories", "/"),
  S("series", "المجموعات (إدارة)", "series", "series", "/subscriptions"),
];

/**
 * العنصر الذي يتأثر بكل قسم داخل صفحة المعاينة (محدِّد CSS). عند التركيز على قسم تنزل المعاينة إلى هذا العنصر وتحيط به بإطار تمييز.
 * أول عنصر ظاهر يطابق المحدِّد يُختار (مثلًا ".side, .bottom": الشريط الجانبي على الكمبيوتر والسفلي على الجوال). غير موجود = بلا تمييز.
 */
export const PREVIEW_FOCUS: Record<string, string> = {
  "settings.info": ".top .brand",
  "settings.logo": ".top .brand",
  "settings.look": ".top .brand",
  "settings.glass": ".top",
  "signup.texts": "#main",
  "signup.methods": ".gbtn",
  "appearance.presets": "#main",
  "behavior.play": ".watch-sticky",
  "menu.nav": ".side, .bottom",
  "watch.buttons": ".actions",
  "watch.suggested": ".suggest",
  "display.tabs": ".chips",
  "display.cont": ".home-continue",
  "display.rows": ".home-blocks",
  "display.mobile": ".grid--home",
  "display.shorts": ".home-shorts",
  "display.groups": "#main .grid",
  "notif.send": ".bell",
  "notif.count": ".bell",
  "notif.sound": ".bell",
  "notif.sent": ".bell",
  videos: ".grid--home",
  shorts: "#main .grid",
  categories: ".chips",
  series: "#main .grid",
};

export const SECTION_BY_ID: Record<string, SectionDef> = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

/** تبويبات لا تُقبل هدفًا للنقل (للمالك فقط، فلا يراها بقية المشرفين). */
export const OWNER_ONLY_TABS: TabId[] = ["members"];

/** التبويب (والمجموعة) الذي تنتقل إليه المربعات تلقائيًا عند حذف تبويبها. نظامي: لا يُحذف ولا يُعاد تسميته. */
export const UNSORTED_TAB: TabId = "unsorted";
export const UNSORTED_GROUP = "unsorted";
export const UNSORTED_LABEL = "غير منظم";
/** مجموعة الترس (تخصيص اللوحة): ثابتة وليست جزءًا من البنية القابلة للتعديل. */
export const CUSTOMIZE_GROUP = "customize";

export const MAX_LABEL = 30;

/** بنية الأشرطة: تبويبات رئيسية (groups) يحوي كلٌّ منها تبويبات فرعية (tabs). */
export type GroupDef = { id: string; label: string };
export type TabDef = { id: TabId; label: string; group: string; ownerOnly?: boolean };
export type Structure = { groups: GroupDef[]; tabs: TabDef[] };

export const DEFAULT_STRUCTURE: Structure = {
  groups: [
    { id: "stats", label: "الإحصائيات" },
    { id: "settings", label: "الإعدادات" },
    { id: "tarbawi", label: "إعدادات تربوية" },
    { id: "notifications", label: "الإشعارات" },
    { id: "organize", label: "التنظيم" },
    { id: "content", label: "إدارة المحتوى" },
    { id: UNSORTED_GROUP, label: UNSORTED_LABEL },
  ],
  tabs: [
    { id: "stats", label: "الإحصائيات", group: "stats" },
    { id: "settings", label: "إعدادات الموقع", group: "settings" },
    { id: "signup", label: "التسجيل", group: "settings" },
    { id: "adhan", label: "إعدادات الأذان", group: "tarbawi" },
    { id: "adhkar", label: "إعدادات الأذكار", group: "tarbawi" },
    { id: "notifications", label: "إدارة الإشعارات", group: "notifications" },
    { id: "appearance", label: "المظهر", group: "organize" },
    { id: "menu", label: "القوائم", group: "organize" },
    { id: "watch", label: "صفحة الفيديو", group: "organize" },
    { id: "display", label: "العرض", group: "organize" },
    { id: "members", label: "الأعضاء", group: "organize", ownerOnly: true },
    { id: "videos", label: "الفيديوهات", group: "content" },
    { id: "shorts", label: "المقاطع القصيرة", group: "content" },
    { id: "categories", label: "التصنيفات", group: "content" },
    { id: "series", label: "المجموعات", group: "content" },
    { id: UNSORTED_TAB, label: UNSORTED_LABEL, group: UNSORTED_GROUP },
  ],
};

export function cloneStructure(s: Structure): Structure {
  return { groups: s.groups.map((g) => ({ ...g })), tabs: s.tabs.map((t) => ({ ...t })) };
}

function cleanLabel(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL) : "";
}

/**
 * ينظّف بنية محفوظة: يحذف المجهول والمكرر والفارغ، ويُسقط المجموعات التي لا تبويب فيها،
 * ويضمن وجود «غير منظم» (آخرًا دائمًا). المدخل غير الصالح = البنية الافتراضية.
 */
export function reconcileStructure(raw: unknown): Structure {
  const r = raw as { groups?: unknown; tabs?: unknown } | null;
  if (!r || typeof r !== "object" || !Array.isArray(r.groups) || !Array.isArray(r.tabs)) return cloneStructure(DEFAULT_STRUCTURE);

  const groups: GroupDef[] = [];
  const gids = new Set<string>();
  for (const g of r.groups as Partial<GroupDef>[]) {
    const id = typeof g?.id === "string" ? g.id : "";
    const label = cleanLabel(g?.label);
    if (!id || !label || id === UNSORTED_GROUP || id === CUSTOMIZE_GROUP || gids.has(id)) continue;
    gids.add(id);
    groups.push({ id, label });
  }

  const tabs: TabDef[] = [];
  const tids = new Set<string>();
  for (const t of r.tabs as Partial<TabDef>[]) {
    const id = typeof t?.id === "string" ? t.id : "";
    const label = cleanLabel(t?.label);
    const group = typeof t?.group === "string" ? t.group : "";
    if (!id || !label || id === UNSORTED_TAB || tids.has(id) || !gids.has(group)) continue;
    tids.add(id);
    tabs.push({ id, label, group, ...(OWNER_ONLY_TABS.includes(id) ? { ownerOnly: true } : {}) });
  }

  const used = new Set(tabs.map((t) => t.group));
  const keptGroups = groups.filter((g) => used.has(g.id));
  keptGroups.push({ id: UNSORTED_GROUP, label: UNSORTED_LABEL });
  tabs.push({ id: UNSORTED_TAB, label: UNSORTED_LABEL, group: UNSORTED_GROUP });
  return { groups: keptGroups, tabs };
}

export function sameStructure(a: Structure, b: Structure): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function tabIdsOf(structure: Structure): TabId[] {
  return structure.tabs.map((t) => t.id);
}

/** معرّف جديد غير مستعمل في البنية الحالية. */
export function newId(prefix: "t" | "g", taken: Set<string>): string {
  let id = "";
  do id = `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  while (taken.has(id));
  return id;
}

export type Arrangement = Record<TabId, string[]>;

export function defaultArrangement(structure: Structure = DEFAULT_STRUCTURE): Arrangement {
  const a: Arrangement = Object.fromEntries(tabIdsOf(structure).map((t) => [t, [] as string[]]));
  for (const s of SECTIONS) a[a[s.home] ? s.home : UNSORTED_TAB].push(s.id);
  return a;
}

/**
 * ينظّف ترتيبًا محفوظًا: يحذف المجهول والمكرر. ما كان في تبويب لم يعد موجودًا (محذوف) ينتقل إلى «غير منظم»،
 * وأي قسم جديد (لم يُحفظ بعد) يُلحق بتبويبه الأصلي، فإن لم يعد له تبويب أصلي ذهب إلى «غير منظم».
 */
export function reconcileArrangement(raw: unknown, structure: Structure = DEFAULT_STRUCTURE): Arrangement {
  const ids = tabIdsOf(structure);
  const out: Arrangement = Object.fromEntries(ids.map((t) => [t, [] as string[]]));
  const seen = new Set<string>();
  const take = (list: unknown, into: TabId) => {
    if (!Array.isArray(list)) return;
    for (const id of list) {
      if (typeof id === "string" && SECTION_BY_ID[id] && !seen.has(id)) {
        seen.add(id);
        out[into].push(id);
      }
    }
  };
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    for (const t of ids) take(r[t], t);
    for (const k of Object.keys(r)) if (!ids.includes(k)) take(r[k], UNSORTED_TAB);
  }
  for (const s of SECTIONS) if (!seen.has(s.id)) out[out[s.home] ? s.home : UNSORTED_TAB].push(s.id);
  return out;
}

export function sameArrangement(a: Arrangement, b: Arrangement): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const t of keys) {
    const x = a[t] ?? [];
    const y = b[t] ?? [];
    if (x.length !== y.length || x.some((id, i) => id !== y[i])) return false;
  }
  return true;
}

/** مكان القسم الحالي. */
export function tabOf(a: Arrangement, id: string): TabId | null {
  for (const t of Object.keys(a)) if (a[t].includes(id)) return t;
  return null;
}
