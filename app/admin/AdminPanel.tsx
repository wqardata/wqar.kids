"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { clearVideoCache } from "@/lib/videos";
import Icon from "@/components/Icon";
import SitePreview from "@/components/SitePreview";
import { PreviewDraftProvider } from "@/lib/preview";
import { useAdminArrangement } from "@/lib/adminLayoutStore";
import { CUSTOMIZE_GROUP, PREVIEW_FOCUS, SECTIONS, SECTION_BY_ID, UNSORTED_GROUP, tabOf, type OwnerId, type TabId } from "@/lib/adminSections";
import VideosTab from "./VideosTab";
import SettingsTab from "./SettingsTab";
import SignupTab from "./SignupTab";
import AppearanceTab from "./AppearanceTab";
import NamedManager from "./NamedManager";
import MenuTab from "./MenuTab";
import StatsTab from "./StatsTab";
import ReportsTab from "./ReportsTab";
import MembersTab from "./MembersTab";
import WatchButtonsEditor from "./WatchButtonsEditor";
import BehaviorPanel from "./BehaviorPanel";
import AdhanTab from "./AdhanTab";
import AdhkarTab from "./AdhkarTab";
import NotificationsTab from "./NotificationsTab";
import DisplayTab from "./DisplayTab";
import SuggestedSettings from "./SuggestedSettings";
import LayoutEditor from "./LayoutEditor";
import { HostCtx, MovableSection, OwnerCtx } from "./sectionKit";
import { SaveBar, SaveProvider, UnsavedDialog, useSaveStore } from "./saveKit";

type Group = string;
type Sub = TabId | "layout-tabs" | "layout-arrange";

type SubTab = { id: Sub; label: string; ownerOnly?: boolean };
type GroupView = { id: Group; label: string; subs: SubTab[] };

/** تبويب الترس: نقل مربعات الإعدادات بين التبويبات وترتيبها، وإضافة التبويبات وإعادة تسميتها وحذفها (انظر LayoutEditor). */
const CUSTOMIZE: GroupView = {
  id: CUSTOMIZE_GROUP,
  label: "تخصيص اللوحة",
  subs: [{ id: "layout-tabs", label: "التبويبات" }, { id: "layout-arrange", label: "تنظيم" }],
};

/** كل مكوّن مالك يحمل حالته ويسجّل حفظه في شريط الحفظ الموحّد؛ أقسامه تُرسم في التبويب المعيَّنة له (انظر sectionKit). */
const OWNERS: Record<OwnerId, () => ReactNode> = {
  stats: () => <StatsTab />,
  reports: () => <MovableSection id="reports"><ReportsTab /></MovableSection>,
  settings: () => <SettingsTab />,
  signup: () => <SignupTab />,
  appearance: () => <AppearanceTab />,
  behavior: () => <BehaviorPanel />,
  menu: () => <MenuTab />,
  watchButtons: () => <WatchButtonsEditor />,
  suggested: () => <SuggestedSettings />,
  display: () => <DisplayTab />,
  adhan: () => <AdhanTab />,
  adhkar: () => <AdhkarTab />,
  notifications: () => <NotificationsTab />,
  members: () => <MovableSection id="members"><MembersTab /></MovableSection>,
  videos: () => <MovableSection id="videos"><VideosTab /></MovableSection>,
  shorts: () => <MovableSection id="shorts"><VideosTab shortsOnly /></MovableSection>,
  categories: () => <MovableSection id="categories"><NamedManager coll="categories" /></MovableSection>,
  series: () => <MovableSection id="series"><NamedManager coll="series" /></MovableSection>,
};
const OWNER_IDS = Object.keys(OWNERS) as OwnerId[];
/** التبويب الأصلي لكل مالك (لإظهار اسمه فوق زر الحفظ إن عُرض في غير مكانه). */
const OWNER_HOME = Object.fromEntries(SECTIONS.map((s) => [s.owner, s.home]).reverse()) as Record<OwnerId, TabId>;

/** مفتاح حفظ آخر تبويب مفتوح في اللوحة (sessionStorage). */
const NAV_KEY = "admin.nav";

export default function AdminPanel({ initial }: { initial?: "series" | "reports" }) {
  const { user, loading, configured, canAdd, isOwner } = useAuth();
  const { arrangement, structure, save } = useAdminArrangement();
  const router = useRouter();
  // الحفظ الموحّد: كل قسم في التبويب المعروض يسجّل مسودته هنا (انظر saveKit).
  const store = useSaveStore();
  // انتقال ينتظر قرار «حفظ / تجاهل» لأن في التبويب تعديلات غير محفوظة.
  const [pending, setPending] = useState<(() => void) | null>(null);
  // يزيد عند «تجاهل»: يعيد تركيب الأقسام فتعود مسوداتها إلى المحفوظ.
  const [epoch, setEpoch] = useState(0);
  const [group, setGroup] = useState<Group>(initial === "series" ? "content" : "stats");
  const [hostEl, setHostEl] = useState<HTMLElement | null>(null);
  // المعاينة مخفية افتراضيًا على كل الشاشات، وتظهر عند الضغط على زر العين فقط.
  const [showPreview, setShowPreview] = useState(false);
  // القسم الذي يعمل عليه المشرف الآن (آخر مربع نقر أو ركّز فيه): المعاينة تنزل إلى العنصر الذي يؤثّر عليه.
  const [activeSection, setActiveSection] = useState("");
  // يُتذكَّر آخر تبويب فرعي في كل مجموعة عند التنقل بينها.
  // (القيمة غير الصالحة — كتبويب حُذف — تُستبدل بأول تبويب فرعي متاح.)
  const [subs, setSubs] = useState<Record<Group, Sub>>({ [CUSTOMIZE_GROUP]: "layout-tabs" });

  // إعادة تحميل الصفحة تفتح نفس التبويب (لا الإحصائيات): نحفظ المجموعة والتبويب الفرعي في sessionStorage (لهذه النافذة فقط)
  // ونستعيدهما بعد التحميل. قيمة غير صالحة (تبويب حُذف أو نُقل) تُعالَج لاحقًا بالرجوع إلى أول تبويب متاح.
  // الرابط /admin?go=… له الأولوية فلا نستعيد معه.
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    if (!initial) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(NAV_KEY) ?? "null");
        if (saved && typeof saved.group === "string") {
          setGroup(saved.group);
          if (saved.subs && typeof saved.subs === "object") {
            const clean: Record<string, Sub> = {};
            for (const [k, v] of Object.entries(saved.subs)) if (typeof v === "string") clean[k] = v;
            setSubs((p) => ({ ...p, ...clean }));
          }
        }
      } catch {
        /* التخزين غير متاح: نبدأ من الافتراضي */
      }
    }
    setNavReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!navReady) return; // لا نكتب قبل الاستعادة كي لا تُمحى القيمة المحفوظة بالافتراضية
    try {
      sessionStorage.setItem(NAV_KEY, JSON.stringify({ group, subs }));
    } catch {
      /* تجاهل */
    }
  }, [navReady, group, subs]);

  // ما يتغيّر في اللوحة (فيديوهات/مجموعات/تصنيفات) يجب أن يظهر فورًا للمشرف: نمسح التخزين المؤقت عند مغادرتها.
  useEffect(() => () => clearVideoCache(), []);

  // إغلاق الصفحة أو إعادة تحميلها وفيها تعديلات غير محفوظة: تحذير المتصفح.
  useEffect(() => {
    if (!store.dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [store.dirty]);

  // الأقسام المعروضة فعلًا: بلا ما هو للمالك وحده إن لم يكن المستخدم مالكًا.
  const shown = useMemo(() => {
    if (isOwner) return arrangement;
    const out = { ...arrangement };
    for (const t of Object.keys(out) as TabId[]) out[t] = out[t].filter((id) => !SECTION_BY_ID[id]?.ownerOnly);
    return out;
  }, [arrangement, isOwner]);

  // الشريط الرئيسي من البنية المحفوظة (تبويبات أضافها المشرف أو أعاد تسميتها أو حذفها) + تبويب الترس الثابت في آخره.
  // لا تُعرض مجموعة بلا تبويب متاح لهذا المستخدم، ولا «غير منظم» ما دام فارغًا.
  const groups = useMemo<GroupView[]>(() => {
    const out: GroupView[] = [];
    for (const g of structure.groups) {
      const subs = structure.tabs
        .filter((t) => t.group === g.id && (!t.ownerOnly || isOwner))
        .map((t) => ({ id: t.id, label: t.label, ownerOnly: t.ownerOnly }));
      if (subs.length === 0) continue;
      if (g.id === UNSORTED_GROUP && !subs.some((t) => (shown[t.id] ?? []).length > 0)) continue;
      out.push({ id: g.id, label: g.label, subs });
    }
    out.push(CUSTOMIZE);
    return out;
  }, [structure, shown, isOwner]);

  // الانتقال من الإشعار إلى /admin?go=reports وأنت داخل اللوحة: نفتح التبويب الذي يحوي قسم المطلوب (قد يكون نُقل).
  const lastInitial = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!initial || lastInitial.current === initial) return;
    lastInitial.current = initial;
    const target: TabId | null = tabOf(arrangement, initial === "series" ? "series" : "reports");
    const g = groups.find((x) => x.subs.some((s) => s.id === target));
    if (target && g) {
      setGroup(g.id);
      setSubs((p) => ({ ...p, [g.id]: target }));
    }
  }, [initial, arrangement, groups]);

  if (!configured) return <p className="note admin-note">لم يُضبط Firebase بعد — راجع README.</p>;
  if (loading) return <p className="note admin-note" role="status">جارٍ التحميل…</p>;
  if (!user) {
    return (
      <div className="admin-note">
        <p className="note">سجّل الدخول للوصول إلى لوحة التحكم.</p>
        <Link href="/login" className="btn">تسجيل الدخول بجوجل</Link>
      </div>
    );
  }
  if (!canAdd) return <p className="note admin-note" role="alert">حسابك ({user.email}) غير مخوّل بدخول لوحة التحكم.</p>;

  const current = groups.find((g) => g.id === group) ?? groups[0];
  const visibleSubs = current.subs.filter((s) => !s.ownerOnly || isOwner);
  const sub = visibleSubs.some((s) => s.id === subs[current.id]) ? subs[current.id] : visibleSubs[0].id;

  const isLayout = sub === "layout-tabs" || sub === "layout-arrange";

  /** ينفّذ الانتقال فورًا، أو يسأل أولًا (حفظ / تجاهل) إن كان في التبويب تعديلات غير محفوظة. */
  const leave = (apply: () => void) => {
    if (store.dirty) setPending(() => apply);
    else apply();
  };
  const goGroup = (g: GroupView) => {
    if (g.id === current.id) return;
    const vs = g.subs.filter((s) => !s.ownerOnly || isOwner);
    const target = vs.some((s) => s.id === subs[g.id]) ? subs[g.id] : vs[0]?.id;
    leave(() => {
      store.clearNotice();
      setGroup(g.id);
      if (target) setSubs((p) => ({ ...p, [g.id]: target }));
    });
  };
  const goSub = (id: Sub) => {
    if (id === sub) return;
    const apply = () => {
      store.clearNotice();
      setSubs((s) => ({ ...s, [current.id]: id }));
    };
    // «التبويبات» و«تنظيم» يشتركان في مسودة واحدة (LayoutEditor نفسه)، فالتنقل بينهما لا يفقد شيئًا.
    if (isLayout && (id === "layout-tabs" || id === "layout-arrange")) apply();
    else leave(apply);
  };
  const saveThenLeave = async () => {
    if (!(await store.saveAll())) return; // بقي الخطأ ظاهرًا ولا ننتقل
    const run = pending;
    setPending(null);
    run?.();
  };
  const discardThenLeave = () => {
    const run = pending;
    setPending(null);
    store.clearNotice();
    setEpoch((e) => e + 1);
    run?.();
  };
  const tab = isLayout ? null : (sub as TabId);
  const list = tab ? shown[tab] ?? [] : [];
  const needed = new Set<OwnerId>(list.map((id) => SECTION_BY_ID[id].owner));
  // المعاينة: القسم النشط في التبويب (وإلا أول قسم له معاينة) يحدد الصفحة والعنصر المميَّز؛ التبويب الذي لا قسم فيه يطلب معاينة (كالإحصائيات) بلا تقسيم.
  const activeId = list.includes(activeSection) ? activeSection : (list.find((id) => SECTION_BY_ID[id].preview) ?? "");
  const previewPath = (activeId && SECTION_BY_ID[activeId].preview) || list.map((id) => SECTION_BY_ID[id].preview).find(Boolean) || "";
  const previewFocus = (activeId && PREVIEW_FOCUS[activeId]) || "";
  const pickSection = (e: { target: EventTarget }) => {
    const id = (e.target as HTMLElement).closest?.("[data-section]")?.getAttribute("data-section");
    if (id) setActiveSection(id);
  };

  return (
    <SaveProvider value={store.api}>
    <PreviewDraftProvider>
      <div className={previewPath ? "admin admin--split" : "admin"}>
        <div className="admin-head">
          <h1>لوحة التحكم</h1>
          <Link
            href="/add"
            className="btn btn--sm"
            onClick={(e) => {
              if (!store.dirty) return;
              e.preventDefault();
              setPending(() => () => router.push("/add"));
            }}
          >
            ＋ إضافة فيديو
          </Link>
        </div>

        <div role="tablist" aria-label="أقسام لوحة التحكم" className="tabs tabs--main">
          {groups.map((g) => (
            <button
              key={g.id}
              id={`group-${g.id}`}
              type="button"
              role="tab"
              aria-selected={current.id === g.id}
              aria-controls="admin-panel"
              aria-label={g.id === CUSTOMIZE_GROUP ? g.label : undefined}
              title={g.id === CUSTOMIZE_GROUP ? g.label : undefined}
              className={current.id === g.id ? (g.id === CUSTOMIZE_GROUP ? "tab tab--gear on" : "tab on") : g.id === CUSTOMIZE_GROUP ? "tab tab--gear" : "tab"}
              onClick={() => goGroup(g)}
            >
              {g.id === CUSTOMIZE_GROUP ? <Icon name="gear" size={20} /> : g.label}
            </button>
          ))}
        </div>

        {visibleSubs.length > 1 && (
          <div role="tablist" aria-label={`أقسام ${current.label}`} className="tabs tabs--sub">
            {visibleSubs.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={sub === t.id}
                aria-controls="admin-panel"
                className={sub === t.id ? "tab on" : "tab"}
                onClick={() => goSub(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {previewPath && (
          <div className="admin-pvtoggle">
            <button
              type="button"
              className="btn btn--ghost btn--sm admin-pvbtn"
              aria-pressed={showPreview}
              aria-label={showPreview ? "إخفاء المعاينة" : "إظهار المعاينة"}
              title={showPreview ? "إخفاء المعاينة" : "إظهار المعاينة"}
              onClick={() => setShowPreview((v) => !v)}
            >
              <Icon name={showPreview ? "eyeoff" : "eye"} size={20} />
            </button>
          </div>
        )}

        <div className={previewPath && showPreview ? "admin-split" : "admin-split admin-split--solo"}>
          <div className="admin-split-main" id="admin-panel" onFocusCapture={pickSection} onPointerDownCapture={pickSection} role="tabpanel" aria-labelledby={visibleSubs.length > 1 ? `tab-${sub}` : `group-${current.id}`}>
            <SaveBar store={store} />
            {isLayout ? (
              <LayoutEditor key={`layout-${epoch}`} view={sub === "layout-tabs" ? "tabs" : "arrange"} structure={structure} arrangement={arrangement} isOwner={isOwner} onSave={save} />
            ) : (
              <HostCtx.Provider value={{ el: hostEl, tab: tab as TabId, arrangement: shown }}>
                <div className="admin-stack msec-host" ref={setHostEl} />
                {list.length === 0 && <p className="empty-note">لا توجد مربعات في هذا التبويب. انقل إليه من تبويب الترس ⚙.</p>}
                {/* الملاك مركّبون هنا (مخفيون) كي تعيش حالتهم؛ واجهتهم تظهر في الحاوية أعلاه. */}
                <div hidden>
                  {OWNER_IDS.filter((o) => needed.has(o)).map((o) => (
                    <OwnerCtx.Provider key={`${o}:${epoch}`} value={{ owner: o, formId: `owner-form-${o}`, home: OWNER_HOME[o] }}>
                      {OWNERS[o]()}
                    </OwnerCtx.Provider>
                  ))}
                </div>
              </HostCtx.Provider>
            )}
          </div>
          {previewPath && showPreview && (
            <aside className="admin-split-side" aria-label="المعاينة">
              <SitePreview path={previewPath} focus={previewFocus} />
            </aside>
          )}
        </div>
      </div>
      {pending && <UnsavedDialog busy={store.busy} error={store.error} onSave={() => void saveThenLeave()} onDiscard={discardThenLeave} onCancel={() => setPending(null)} />}
    </PreviewDraftProvider>
    </SaveProvider>
  );
}
