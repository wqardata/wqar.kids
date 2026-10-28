"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import type { IconName } from "@/lib/data";
import { DEFAULT_SETTINGS, WATCH_BUILTINS, WATCH_LINK_ICONS, cleanUrl, useSettings, type WatchButton } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection } from "./sectionKit";
import { useSettingsOwner } from "./saveKit";

const builtinLabel = (id: string) => WATCH_BUILTINS.find((b) => b.id === id)?.label ?? id;

/** تحرير الأزرار أسفل مشغّل الفيديو: ترتيبها وإظهارها وإضافة أزرار روابط. */
export default function WatchButtonsEditor() {
  const { settings, ready } = useSettings();
  const [list, setList] = useState<WatchButton[]>(settings.watchButtons);
  usePreviewDraft("watch-buttons", { watchButtons: list.filter((b) => b.kind !== "link" || (b.label.trim() && cleanUrl(b.href))).map((b) => (b.kind === "link" ? { ...b, label: b.label.trim(), href: cleanUrl(b.href) } : b)) });
  const [open, setOpen] = useState("");
  const draftPatch = useMemo(() => ({ watchButtons: list.map((b) => (b.kind === "link" ? { ...b, label: b.label.trim(), href: cleanUrl(b.href) } : b)) }), [list]);
  useSettingsOwner({
    patch: draftPatch,
    validate: () => {
      for (const b of list) {
        if (b.kind !== "link") continue;
        if (!b.label.trim()) return "اكتب اسمًا لكل زر رابط.";
        if (!cleanUrl(b.href)) return `رابط «${b.label.trim()}» غير صالح (يجب أن يبدأ بـ https://).`;
      }
      return "";
    },
    afterSave: (saved) => setList(saved.watchButtons),
    reset: () => setList(DEFAULT_SETTINGS.watchButtons),
  });

  const change = (fn: (l: WatchButton[]) => WatchButton[]) => {
    setList(fn);
  };
  const move = (i: number, dir: -1 | 1) =>
    change((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const patch = (id: string, p: Partial<WatchButton>) => change((l) => l.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const remove = (id: string) => change((l) => l.filter((b) => b.id !== id));
  const addLink = () => {
    const id = `link-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    change((l) => [...l, { id, kind: "link", label: "", icon: "link", href: "", show: true }]);
    setOpen(id);
  };

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <MovableSection id="watch.buttons">
    <div className="panel menu-admin">
      <h2>أزرار صفحة الفيديو</h2>
      <p className="hint">تظهر أسفل مشغّل الفيديو بالترتيب أدناه. استخدم الأسهم لإعادة الترتيب، والعين للإخفاء، ويمكنك إضافة أزرار تفتح رابطًا (مثل: ادعمنا، تيليجرام).</p>
      <ul className="wb-list">
        {list.map((b, i) => (
          <li key={b.id} className={b.show ? "wb-row" : "wb-row off"}>
            <div className="addrow">
              <button type="button" className="ibtn" aria-label={`رفع «${b.kind === "link" ? b.label || "زر جديد" : builtinLabel(b.id)}»`} title="رفع" disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="up" size={18} />
              </button>
              <button type="button" className="ibtn" aria-label={`خفض «${b.kind === "link" ? b.label || "زر جديد" : builtinLabel(b.id)}»`} title="خفض" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                <Icon name="chevdown" size={18} />
              </button>
              {b.kind === "builtin" ? (
                <span className="wb-name">{builtinLabel(b.id)}</span>
              ) : (
                <>
                  <button type="button" className="ibtn" aria-expanded={open === b.id} aria-label="اختيار أيقونة الزر" title="تغيير الأيقونة" onClick={() => setOpen(open === b.id ? "" : b.id)}>
                    <Icon name={b.icon} size={20} />
                  </button>
                  <input aria-label="اسم الزر" placeholder="اسم الزر" value={b.label} maxLength={24} onChange={(e) => patch(b.id, { label: e.target.value })} />
                </>
              )}
              <button
                type="button"
                className={b.show ? "ibtn on" : "ibtn"}
                role="switch"
                aria-checked={b.show}
                aria-label={`${b.show ? "إخفاء" : "إظهار"} الزر`}
                title={b.show ? "ظاهر (اضغط للإخفاء)" : "مخفي (اضغط للإظهار)"}
                onClick={() => patch(b.id, { show: !b.show })}
              >
                <Icon name={b.show ? "eye" : "eyeoff"} size={20} />
              </button>
              {b.kind === "link" && (
                <button type="button" className="ibtn danger" aria-label="حذف الزر" title="حذف" onClick={() => remove(b.id)}>
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>
            {b.kind === "link" && (
              <div className="addrow">
                <input dir="ltr" aria-label="رابط الزر" placeholder="https://…" value={b.href} onChange={(e) => patch(b.id, { href: e.target.value })} />
              </div>
            )}
            {b.kind === "link" && open === b.id && (
              <div className="icon-grid" role="radiogroup" aria-label="الأيقونات">
                {WATCH_LINK_ICONS.map((ic: IconName) => (
                  <button key={ic} type="button" role="radio" aria-checked={b.icon === ic} aria-label={ic} className={b.icon === ic ? "ibtn on" : "ibtn"} onClick={() => patch(b.id, { icon: ic })}>
                    <Icon name={ic} size={22} />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="addrow">
        <button type="button" className="btn btn--ghost" onClick={addLink} disabled={list.length >= 24}>＋ إضافة زر رابط</button>
      </div>
    </div>
    </MovableSection>
  );
}
