"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { MENU_ICONS } from "@/lib/data";
import { saveSettings, useSettings } from "@/lib/settings";
import {
  BUILTIN_LABEL,
  DEFAULT_VIDEO_PAGE,
  MAX_CUSTOM_BUTTONS,
  validTemplate,
  type VideoButton,
  type VideoPageConfig,
} from "@/lib/videoPage";

const newId = () => `c${Math.random().toString(36).slice(2, 8)}`;

/** تعديل تصميم صفحة الفيديو: أزرار مدمجة (إظهار/ترتيب/كلمة) وأزرار روابط مخصّصة وأقسام الصفحة. */
export default function VideoPageTab() {
  const { settings, update, ready } = useSettings();
  const [cfg, setCfg] = useState<VideoPageConfig>(settings.videoPage);
  const [openIcons, setOpenIcons] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const change = (fn: (c: VideoPageConfig) => VideoPageConfig) => {
    setDone(false);
    setCfg(fn);
  };
  const patchBtn = (id: string, p: Partial<VideoButton>) =>
    change((c) => ({ ...c, buttons: c.buttons.map((b) => (b.id === id ? { ...b, ...p } : b)) }));
  const move = (id: string, dir: -1 | 1) =>
    change((c) => {
      const i = c.buttons.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.buttons.length) return c;
      const arr = [...c.buttons];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, buttons: arr };
    });
  const remove = (id: string) => change((c) => ({ ...c, buttons: c.buttons.filter((b) => b.id !== id) }));
  const customCount = cfg.buttons.filter((b) => b.kind === "custom").length;
  const add = () =>
    change((c) => ({
      ...c,
      buttons: [...c.buttons, { id: newId(), kind: "custom", on: true, showLabel: true, label: "", icon: "link", url: "https://", newTab: true }],
    }));

  async function save() {
    setError("");
    for (const b of cfg.buttons) {
      if (b.kind !== "custom") continue;
      if (!b.label.trim()) return setError("اكتب اسمًا لكل زر مخصّص.");
      if (!validTemplate(b.url)) return setError(`رابط الزر «${b.label}» غير صالح. يجب أن يبدأ بـ https:// (ويمكن استعمال {id} {title} {driveId} {url}).`);
    }
    setSaving(true);
    try {
      const saved = await saveSettings({ ...settings, videoPage: cfg });
      update(saved);
      setCfg(saved.videoPage);
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
      <p className="hint">
        رتّب أزرار صفحة الفيديو، أظهر أو أخفِ أي زر، واختر عرض الكلمة بجانب الأيقونة. يمكنك إضافة أزرار روابط مخصّصة (حتى {MAX_CUSTOM_BUTTONS}) مثل «تيليجرام» أو «تبرع».
      </p>

      <h2>الأزرار</h2>
      <ul className="menu-list">
        {cfg.buttons.map((b, i) => {
          const custom = b.kind === "custom";
          const name = custom ? b.label || "زر جديد" : BUILTIN_LABEL[b.kind];
          return (
            <li key={b.id} className={`vp-row${b.on ? "" : " vp-row--off"}`}>
              <div className="addrow">
                <button type="button" className="ibtn" role="switch" aria-checked={b.on} aria-label={`${b.on ? "إخفاء" : "إظهار"} زر ${name}`} title={b.on ? "ظاهر (اضغط للإخفاء)" : "مخفي (اضغط للإظهار)"} onClick={() => patchBtn(b.id, { on: !b.on })}>
                  <Icon name={b.on ? "eye" : "eyeoff"} size={20} />
                </button>
                <strong style={{ flex: 1, minWidth: 80 }}>{custom ? "زر مخصّص" : name}{!custom && <small className="hint"> (مدمج)</small>}</strong>
                <button type="button" className="ibtn" aria-label={`تحريك ${name} للأمام`} disabled={i === 0} onClick={() => move(b.id, -1)}><Icon name="up" size={18} /></button>
                <button type="button" className="ibtn" aria-label={`تحريك ${name} للخلف`} disabled={i === cfg.buttons.length - 1} onClick={() => move(b.id, 1)}><Icon name="chevdown" size={18} /></button>
                {custom && <button type="button" className="ibtn danger" aria-label={`حذف ${name}`} onClick={() => remove(b.id)}><Icon name="trash" size={18} /></button>}
              </div>
              <label className="check"><input type="checkbox" checked={b.showLabel} onChange={(e) => patchBtn(b.id, { showLabel: e.target.checked })} /> إظهار الكلمة بجانب الأيقونة</label>
              {custom && (
                <>
                  <div className="addrow">
                    <button type="button" className="ibtn" aria-expanded={openIcons === b.id} aria-label="اختيار الأيقونة" title="تغيير الأيقونة" onClick={() => setOpenIcons(openIcons === b.id ? "" : b.id)}>
                      <Icon name={b.icon} size={20} />
                    </button>
                    <input aria-label="اسم الزر" placeholder="اسم الزر" maxLength={24} value={b.label} onChange={(e) => patchBtn(b.id, { label: e.target.value })} />
                  </div>
                  {openIcons === b.id && (
                    <div className="icon-grid" role="radiogroup" aria-label="الأيقونات">
                      {MENU_ICONS.map((ic) => (
                        <button key={ic} type="button" role="radio" aria-checked={b.icon === ic} aria-label={ic} className={b.icon === ic ? "ibtn on" : "ibtn"} onClick={() => patchBtn(b.id, { icon: ic })}>
                          <Icon name={ic} size={20} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="field">
                    <input dir="ltr" type="url" aria-label="رابط الزر" placeholder="https://t.me/yourchannel" maxLength={500} value={b.url} onChange={(e) => patchBtn(b.id, { url: e.target.value })} />
                    <p className="hint" dir="rtl">متغيرات اختيارية في الرابط: <code>{"{id}"}</code> معرّف الفيديو، <code>{"{title}"}</code> العنوان، <code>{"{driveId}"}</code> معرّف درايف، <code>{"{url}"}</code> رابط الصفحة.</p>
                  </div>
                  <label className="check"><input type="checkbox" checked={b.newTab} onChange={(e) => patchBtn(b.id, { newTab: e.target.checked })} /> يفتح في نافذة جديدة</label>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="addrow">
        <button type="button" className="btn btn--ghost btn--sm" onClick={add} disabled={customCount >= MAX_CUSTOM_BUTTONS}>＋ إضافة زر مخصّص</button>
      </div>

      <h2>الأقسام</h2>
      <label className="check"><input type="checkbox" checked={cfg.showMeta} onChange={(e) => change((c) => ({ ...c, showMeta: e.target.checked }))} /> سطر التصنيف والسلسلة والحلقة</label>
      <label className="check"><input type="checkbox" checked={cfg.showDescription} onChange={(e) => change((c) => ({ ...c, showDescription: e.target.checked }))} /> وصف الفيديو</label>
      <label className="check"><input type="checkbox" checked={cfg.showSuggested} onChange={(e) => change((c) => ({ ...c, showSuggested: e.target.checked }))} /> قائمة الفيديوهات المقترحة</label>

      <h2>معاينة الأزرار</h2>
      <div className="vp-preview" aria-label="معاينة">
        {cfg.buttons.filter((b) => b.on).map((b) => {
          const icon = b.kind === "custom" ? b.icon : b.kind === "favorite" ? "heart" : b.kind === "like" ? "like" : b.kind === "share" ? "share" : "flag";
          const label = b.kind === "custom" ? b.label || "زر" : BUILTIN_LABEL[b.kind];
          return (
            <span key={b.id} className={`ibtn${b.showLabel ? " ibtn--text" : ""}`}>
              <Icon name={icon} size={20} />
              {b.showLabel && <span>{label}</span>}
            </span>
          );
        })}
        {cfg.buttons.every((b) => !b.on) && <span className="hint">لا أزرار ظاهرة.</span>}
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ تصميم صفحة الفيديو ✓</p>}
      <div className="addrow">
        <button type="button" onClick={() => void save()} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ التصميم"}</button>
        <button type="button" className="btn btn--ghost" onClick={() => change(() => DEFAULT_VIDEO_PAGE)}>استعادة الافتراضي</button>
      </div>
    </div>
  );
}
