"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { MENU_ICONS, more, nav, type IconName, type NavItem } from "@/lib/data";
import { saveSettings, useSettings, type NavOverrides } from "@/lib/settings";

const GROUPS: { title: string; items: readonly NavItem[] }[] = [
  { title: "القائمة الرئيسية (تظهر أيضًا في الشريط السفلي على الجوال)", items: nav },
  { title: "قائمة المزيد", items: more },
];

export default function MenuTab() {
  const { settings, update, ready } = useSettings();
  const [ov, setOv] = useState<NavOverrides>(settings.navItems);
  const [open, setOpen] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const cur = (n: NavItem) => ({ label: ov[n.href]?.label ?? n.label, icon: ov[n.href]?.icon ?? n.icon });
  const edit = (n: NavItem, patch: Partial<{ label: string; icon: IconName }>) => {
    setDone(false);
    setOv((o) => ({ ...o, [n.href]: { ...cur(n), ...patch } }));
  };
  const reset = (n: NavItem) => {
    setDone(false);
    setOv((o) => {
      const { [n.href]: _drop, ...rest } = o;
      return rest;
    });
  };

  async function save() {
    setError("");
    const all = [...nav, ...more];
    if (all.some((n) => ov[n.href] && !ov[n.href].label.trim())) return setError("اسم عنصر القائمة لا يمكن أن يكون فارغًا.");
    // نحفظ ما يختلف عن الافتراضي فقط.
    const clean: NavOverrides = {};
    for (const n of all) {
      const o = ov[n.href];
      if (o && (o.label.trim() !== n.label || o.icon !== n.icon)) clean[n.href] = { label: o.label.trim(), icon: o.icon };
    }
    setSaving(true);
    try {
      const saved = await saveSettings({ ...settings, navItems: clean });
      update(saved);
      setOv(saved.navItems);
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <div className="panel menu-admin">
      <p className="hint">غيّر اسم أي صفحة في القائمة وأيقونتها. المسارات لا تتغيّر، فالروابط الحالية تبقى تعمل.</p>
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2>{g.title}</h2>
          <ul className="menu-list">
            {g.items.map((n) => {
              const c = cur(n);
              const changed = Boolean(ov[n.href]) && (c.label !== n.label || c.icon !== n.icon);
              return (
                <li key={n.href} className="menu-row">
                  <div className="addrow">
                    <button type="button" className="ibtn" aria-expanded={open === n.href} aria-label={`اختيار أيقونة «${c.label}»`} title="تغيير الأيقونة" onClick={() => setOpen(open === n.href ? "" : n.href)}>
                      <Icon name={c.icon} size={22} />
                    </button>
                    <input aria-label={`اسم ${n.label}`} value={c.label} maxLength={24} onChange={(e) => edit(n, { label: e.target.value })} />
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
      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ القائمة ✓</p>}
      <div className="addrow">
        <button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ القائمة"}</button>
        <button type="button" className="btn btn--ghost" onClick={() => { setOv({}); setDone(false); }}>استعادة الكل</button>
      </div>
    </div>
  );
}
