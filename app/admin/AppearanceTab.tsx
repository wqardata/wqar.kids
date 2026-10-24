"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { applyTheme, saveSettings, useSettings } from "@/lib/settings";
import {
  BASE_SIZE_DEFAULT,
  BASE_SIZE_MAX,
  BASE_SIZE_MIN,
  COLOR_KEYS,
  COLOR_LABELS,
  DEFAULT_COLORS,
  DEFAULT_THEME,
  PRESETS,
  SITE_FONTS,
  contrastRatio,
  effectiveColors,
  type ColorKey,
  type SiteFontId,
  type Theme,
} from "@/lib/theme";

type Mode = "light" | "dark";
const MODE_LABEL: Record<Mode, string> = { light: "الوضع الفاتح", dark: "الوضع الداكن" };

/** أزواج الألوان التي يجب أن يكون بينها تباين كافٍ لقراءة مريحة. */
const PAIRS: { fg: ColorKey; bg: ColorKey; label: string }[] = [
  { fg: "ink", bg: "bg", label: "النص على الخلفية" },
  { fg: "ink", bg: "surface", label: "النص على البطاقات" },
  { fg: "mute", bg: "bg", label: "النص الثانوي على الخلفية" },
  { fg: "accent", bg: "bg", label: "اللون المميّز على الخلفية" },
  { fg: "accentInk", bg: "accent", label: "نص الأزرار على اللون المميّز" },
];
const MIN_CONTRAST = 4.5;

function fontCss(id: SiteFontId | "same", body: SiteFontId): string | undefined {
  const real = id === "same" ? body : id;
  return SITE_FONTS.find((f) => f.id === real)?.css || undefined;
}

/** معاينة مصغّرة للموقع بألوان وضع معيّن (مستقلة عن وضع جهازك الحالي). */
function Preview({ theme, mode }: { theme: Theme; mode: Mode }) {
  const c = effectiveColors(theme, mode);
  const style = {
    background: c.bg,
    color: c.ink,
    borderColor: c.line,
    fontSize: theme.baseSize,
    fontFamily: fontCss(theme.bodyFont, theme.bodyFont),
  } as CSSProperties;
  return (
    <div className="pv" style={style} role="img" aria-label={`معاينة ${MODE_LABEL[mode]}`}>
      <div className="pv-bar" style={{ borderColor: c.line }}>
        <strong style={{ color: c.accent }}>اسم الموقع</strong>
        <span className="pv-pill" style={{ background: c.accent, color: c.accentInk }}>تسجيل الدخول</span>
      </div>
      <div className="pv-card" style={{ background: c.surface, borderColor: c.line }}>
        <h4 style={{ fontFamily: fontCss(theme.headingFont, theme.bodyFont) }}>عنوان فيديو تجريبي</h4>
        <p style={{ color: c.mute }}>التصنيف • السلسلة</p>
        <span className="pv-pill" style={{ background: c.accent, color: c.accentInk }}>زر تجريبي</span>
      </div>
      <small className="pv-label" style={{ color: c.mute }}>{MODE_LABEL[mode]}</small>
    </div>
  );
}

function ColorRow({ k, mode, theme, onChange }: { k: ColorKey; mode: Mode; theme: Theme; onChange: (v: string) => void }) {
  const id = `col-${mode}-${k}`;
  const custom = theme[mode][k];
  const shown = custom || (k === "accentInk" && theme[mode].accent ? effectiveColors(theme, mode).accentInk : DEFAULT_COLORS[mode][k]);
  return (
    <div className="field crow">
      <label htmlFor={id}>
        {COLOR_LABELS[k].label}
        <small className="hint">{COLOR_LABELS[k].hint}</small>
      </label>
      <div className="colorrow">
        <input id={id} type="color" value={shown} onChange={(e) => onChange(e.target.value)} />
        <code dir="ltr">{custom || "افتراضي"}</code>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange("")} disabled={!custom}>
          افتراضي
        </button>
      </div>
    </div>
  );
}

export default function AppearanceTab() {
  const { settings, update, ready } = useSettings();
  const [theme, setTheme] = useState<Theme>(settings.theme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const saved = useRef(settings.theme);
  saved.current = settings.theme;

  // معاينة مباشرة على الصفحة كلها دون حفظ. عند مغادرة التبويب نعيد الثيم المحفوظ.
  useEffect(() => {
    applyTheme(theme, false);
  }, [theme]);
  useEffect(() => () => applyTheme(saved.current), []);

  const edit = (fn: (t: Theme) => Theme) => {
    setDone(false);
    setTheme(fn);
  };
  const setColor = (mode: Mode, k: ColorKey, v: string) =>
    edit((t) => (mode === "light" ? { ...t, light: { ...t.light, [k]: v } } : { ...t, dark: { ...t.dark, [k]: v } }));

  const checks = useMemo(
    () =>
      (["light", "dark"] as Mode[]).map((mode) => {
        const c = effectiveColors(theme, mode);
        const bad = PAIRS.map((p) => ({ ...p, ratio: contrastRatio(c[p.fg], c[p.bg]) })).filter((p) => p.ratio < MIN_CONTRAST);
        return { mode, bad };
      }),
    [theme],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const out = await saveSettings({ ...settings, theme });
      update(out);
      setTheme(out.theme);
      setDone(true);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <form className="admin-stack" onSubmit={(e) => void onSubmit(e)}>
      <section className="panel panel--wide auth-form" aria-labelledby="ap-h-presets">
      <h2 id="ap-h-presets">ألوان جاهزة ومعاينة</h2>
      <p className="hint">اختر لوحة جاهزة ثم عدّل أي لون بعدها. المعاينة تظهر مباشرة على هذه الصفحة ولا تُحفظ حتى تضغط «حفظ».</p>
      <div className="addrow">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => edit((t) => ({ ...t, light: { ...DEFAULT_THEME.light, ...p.light }, dark: { ...DEFAULT_THEME.dark, ...p.dark } }))}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="pv-row">
        <Preview theme={theme} mode="light" />
        <Preview theme={theme} mode="dark" />
      </div>

      </section>

      {(["light", "dark"] as Mode[]).map((mode) => (
        <section key={mode} className="panel panel--wide auth-form" aria-labelledby={`ap-h-${mode}`}>
        <h2 id={`ap-h-${mode}`}>ألوان {MODE_LABEL[mode]}</h2>
        <fieldset className="cset">
          <legend className="sr-only">{MODE_LABEL[mode]}</legend>
          <div className="cgrid">
            {COLOR_KEYS.map((k) => (
              <ColorRow key={k} k={k} mode={mode} theme={theme} onChange={(v) => setColor(mode, k, v)} />
            ))}
          </div>
          {checks.find((c) => c.mode === mode)?.bad.map((b) => (
            <p key={b.label} className="warn" role="status">
              ⚠ {b.label}: التباين {b.ratio.toFixed(1)}:1 — الأفضل {MIN_CONTRAST}:1 أو أكثر ليسهل القراءة.
            </p>
          ))}
        </fieldset>
        {mode === "dark" && <p className="hint">الموقع يتبدّل بين الفاتح والداكن حسب إعداد جهاز الزائر، لذا اضبط الوضعين.</p>}
        </section>
      ))}

      <section className="panel panel--wide auth-form" aria-labelledby="ap-h-fonts">
      <h2 id="ap-h-fonts">الخطوط والحجم</h2>
      <div className="two">
        <div className="field">
          <label htmlFor="ap-body">خط النصوص</label>
          <select id="ap-body" value={theme.bodyFont} onChange={(e) => edit((t) => ({ ...t, bodyFont: e.target.value as SiteFontId }))}>
            {SITE_FONTS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ap-head">خط العناوين</label>
          <select id="ap-head" value={theme.headingFont} onChange={(e) => edit((t) => ({ ...t, headingFont: e.target.value as Theme["headingFont"] }))}>
            <option value="same">نفس خط النصوص</option>
            {SITE_FONTS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="ap-size">حجم الخط الأساسي: {theme.baseSize}px {theme.baseSize === BASE_SIZE_DEFAULT && "(الافتراضي)"}</label>
        <input id="ap-size" type="range" min={BASE_SIZE_MIN} max={BASE_SIZE_MAX} step={1} value={theme.baseSize} onChange={(e) => edit((t) => ({ ...t, baseSize: Number(e.target.value) }))} />
        <p className="hint">يكبّر أو يصغّر كل نصوص الموقع معًا. خط اسم الموقع وحجمه ولونه من «إعدادات الموقع».</p>
      </div>

      </section>

      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم حفظ المظهر ✓ — يظهر للزوار فورًا.</p>}
      <div className="addrow">
        <button type="submit" className="btn" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ المظهر"}</button>
        <button type="button" className="btn btn--ghost" onClick={() => edit(() => DEFAULT_THEME)}>استعادة الافتراضي</button>
      </div>
    </form>
  );
}
