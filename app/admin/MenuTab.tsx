"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { MENU_ICONS, more, nav, type IconName, type NavItem } from "@/lib/data";
import { NAV_ALWAYS_SHOWN, NAV_MAIN_MAX, resolveNav, saveSettings, useSettings, type NavLayout, type NavOverrides } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerFooter, OwnerForm } from "./sectionKit";

const ALL: readonly NavItem[] = [...nav, ...more];
const byHref = (h: string) => ALL.find((n) => n.href === h);
type Section = "main" | "more";
const TITLES: Record<Section, string> = {
  main: `القائمة الرئيسية (تظهر أيضًا في الشريط السفلي على الجوال — حتى ${NAV_MAIN_MAX} عناصر)`,
  more: "قائمة المزيد",
};

export default function MenuTab() {
  const { settings, update, ready } = useSettings();
  const [ov, setOv] = useState<NavOverrides>(settings.navItems);
  const [hid, setHid] = useState<string[]>(settings.navHidden);
  const [lay, setLay] = useState<{ main: string[]; more: string[] }>(() => {
    const r = resolveNav(settings.navLayout);
    return { main: r.main.map((n) => n.href), more: r.more.map((n) => n.href) };
  });
  const [open, setOpen] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const cur = (n: NavItem) => ({ label: ov[n.href]?.label ?? n.label, icon: ov[n.href]?.icon ?? n.icon });
  const edit = (n: NavItem, patch: Partial<{ label: string; icon: IconName }>) => {
    setDone(false);
    setOv((o) => ({ ...o, [n.href]: { ...cur(n), ...patch } }));
  };
  const toggleShown = (n: NavItem, shown: boolean) => {
    setDone(false);
    setHid((h) => (shown ? h.filter((x) => x !== n.href) : h.includes(n.href) ? h : [...h, n.href]));
  };
  const reset = (n: NavItem) => {
    setDone(false);
    setOv((o) => {
      const { [n.href]: _drop, ...rest } = o;
      return rest;
    });
  };
  /** تحريك عنصر لأعلى/أسفل داخل قسمه. */
  const move = (sec: Section, i: number, dir: -1 | 1) => {
    setDone(false);
    setLay((l) => {
      const j = i + dir;
      if (j < 0 || j >= l[sec].length) return l;
      const c = [...l[sec]];
      [c[i], c[j]] = [c[j], c[i]];
      return { ...l, [sec]: c };
    });
  };
  /** نقل عنصر إلى القسم الآخر (يُضاف في آخره). */
  const transfer = (sec: Section, href: string) => {
    const to: Section = sec === "main" ? "more" : "main";
    setDone(false);
    setError("");
    if (to === "main" && lay.main.length >= NAV_MAIN_MAX) return setError(`القائمة الرئيسية تتسع لـ ${NAV_MAIN_MAX} عناصر كحدّ أقصى (الشريط السفلي للجوال). انقل عنصرًا منها أولًا.`);
    if (sec === "main" && lay.main.length <= 1) return;
    setLay((l) => ({ [sec]: l[sec].filter((h) => h !== href), [to]: [...l[to], href] }) as NavLayout);
  };

  const isDefaultLayout = () => {
    const eq = (a: string[], b: readonly NavItem[]) => a.length === b.length && a.every((h, i) => h === b[i].href);
    return eq(lay.main, nav) && eq(lay.more, more);
  };

  const previewNav: NavOverrides = {};
  for (const k of Object.keys(ov)) {
    const o = ov[k];
    if (o && o.label.trim()) previewNav[k] = { label: o.label.trim(), icon: o.icon };
  }
  usePreviewDraft("menu", { navItems: previewNav, navHidden: hid, navLayout: (isDefaultLayout() ? { main: [], more: [] } : lay) as NavLayout });

  async function save() {
    setError("");
    if (ALL.some((n) => ov[n.href] && !ov[n.href].label.trim())) return setError("اسم عنصر القائمة لا يمكن أن يكون فارغًا.");
    // نحفظ ما يختلف عن الافتراضي فقط.
    const clean: NavOverrides = {};
    for (const n of ALL) {
      const o = ov[n.href];
      if (o && (o.label.trim() !== n.label || o.icon !== n.icon)) clean[n.href] = { label: o.label.trim(), icon: o.icon };
    }
    setSaving(true);
    try {
      const navLayout: NavLayout = isDefaultLayout() ? { main: [], more: [] } : lay;
      const saved = await saveSettings({ ...settings, navItems: clean, navHidden: hid, navLayout });
      update(saved);
      setOv(saved.navItems);
      setHid(saved.navHidden);
      const r = resolveNav(saved.navLayout);
      setLay({ main: r.main.map((n) => n.href), more: r.more.map((n) => n.href) });
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <>
    <MovableSection id="menu.nav">
    <div className="panel menu-admin">
      <p className="hint">
        غيّر اسم أي صفحة وأيقونتها، أو أخفِها بإلغاء «إظهار». استخدم الأسهم لتحريك العنصر لأعلى أو أسفل، وزر النقل لإرساله إلى القسم الآخر. المسارات لا تتغيّر، فالروابط الحالية تبقى تعمل حتى للعناصر المخفية. الرئيسية تبقى ظاهرة وفي القسم الأول دائمًا.
      </p>
      {(["main", "more"] as const).map((sec) => (
        <section key={sec}>
          <h2>{TITLES[sec]}</h2>
          {lay[sec].length === 0 && <p className="hint">لا عناصر في هذا القسم.</p>}
          <ul className="menu-list">
            {lay[sec].map((href, i) => {
              const n = byHref(href);
              if (!n) return null;
              const c = cur(n);
              const changed = Boolean(ov[n.href]) && (c.label !== n.label || c.icon !== n.icon);
              const shown = !hid.includes(n.href);
              const locked = NAV_ALWAYS_SHOWN.includes(n.href);
              const other = sec === "main" ? "المزيد" : "الرئيسية";
              return (
                <li key={n.href} className="menu-row">
                  <div className="addrow">
                    <button type="button" className="ibtn" aria-label={`رفع «${c.label}»`} title="رفع" disabled={i === 0} onClick={() => move(sec, i, -1)}>
                      <Icon name="up" size={18} />
                    </button>
                    <button type="button" className="ibtn" aria-label={`خفض «${c.label}»`} title="خفض" disabled={i === lay[sec].length - 1} onClick={() => move(sec, i, 1)}>
                      <Icon name="chevdown" size={18} />
                    </button>
                    <button
                      type="button"
                      className={shown ? "ibtn on" : "ibtn"}
                      role="switch"
                      aria-checked={shown}
                      disabled={locked}
                      aria-label={`${shown ? "إخفاء" : "إظهار"} «${c.label}» في القائمة`}
                      title={locked ? "الرئيسية تبقى ظاهرة دائمًا" : shown ? "ظاهر في القائمة (اضغط للإخفاء)" : "مخفي من القائمة (اضغط للإظهار)"}
                      onClick={() => toggleShown(n, !shown)}
                    >
                      <Icon name={shown ? "eye" : "eyeoff"} size={20} />
                    </button>
                    <button type="button" className="ibtn" aria-expanded={open === n.href} aria-label={`اختيار أيقونة «${c.label}»`} title="تغيير الأيقونة" onClick={() => setOpen(open === n.href ? "" : n.href)}>
                      <Icon name={c.icon} size={22} />
                    </button>
                    <input aria-label={`اسم ${n.label}`} value={c.label} maxLength={24} onChange={(e) => edit(n, { label: e.target.value })} />
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => transfer(sec, n.href)} disabled={locked} title={`نقل إلى ${other}`}>
                      نقل إلى {other}
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => reset(n)} disabled={!changed}>الافتراضي</button>
                  </div>
                  <small className="hint" dir="ltr">{n.href}</small>
                  {open === n.href && (
                    <div className="icon-grid" role="radiogroup" aria-label="الأيقونات">
                      {MENU_ICONS.map((ic) => (
                        <button key={ic} type="button" role="radio" aria-checked={c.icon === ic} aria-label={ic} className={c.icon === ic ? "ibtn on" : "ibtn"} onClick={() => edit(n, { icon: ic })}>
                          <Icon name={ic} size={22} />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
    </MovableSection>
    <OwnerFooter>
      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ القائمة ✓</p>}
      <div className="addrow">
        <button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ القائمة"}</button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => { setOv({}); setHid([]); setLay({ main: nav.map((n) => n.href), more: more.map((n) => n.href) }); setDone(false); }}
        >
          استعادة الكل
        </button>
      </div>
    </OwnerFooter>
    </>
  );
}
