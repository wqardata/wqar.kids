"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { SplashView } from "@/components/Splash";
import { fileToLogo } from "@/lib/logoFile";
import {
  DEFAULT_SPLASH,
  SPLASH_DUR_MAX,
  SPLASH_DUR_MIN,
  SPLASH_IN,
  SPLASH_MOTION,
  SPLASH_OUT,
  SPLASH_SIZE_MAX,
  SPLASH_SIZE_MIN,
  DEFAULT_SETTINGS,
  applyTheme,
  useSettings,
  type SplashCfg,
} from "@/lib/settings";
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
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerForm } from "./sectionKit";
import { useSettingsOwner } from "./saveKit";

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
        <p style={{ color: c.mute }}>التصنيف • المجموعة</p>
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
  const { settings, ready } = useSettings();
  const [theme, setTheme] = useState<Theme>(settings.theme);
  const [splashOn, setSplashOn] = useState(settings.splash);
  const [sp, setSp] = useState<SplashCfg>(settings.splashCfg);
  usePreviewDraft("appearance", { theme, splash: splashOn, splashCfg: sp });
  const [spRun, setSpRun] = useState(0); // يزيد لإعادة تشغيل معاينة شاشة الشعار
  const patch = useMemo(() => ({ theme, splash: splashOn, splashCfg: sp }), [theme, splashOn, sp]);
  const { setError } = useSettingsOwner({
    patch,
    afterSave: (out) => {
      setTheme(out.theme);
      setSplashOn(out.splash);
      setSp(out.splashCfg);
    },
    reset: () => {
      setTheme(DEFAULT_SETTINGS.theme);
      setSplashOn(DEFAULT_SETTINGS.splash);
      setSp(DEFAULT_SETTINGS.splashCfg);
    },
  });

  const saved = useRef(settings.theme);
  saved.current = settings.theme;

  // معاينة مباشرة على الصفحة كلها دون حفظ. عند مغادرة التبويب نعيد الثيم المحفوظ.
  useEffect(() => {
    applyTheme(theme, false);
  }, [theme]);
  useEffect(() => () => applyTheme(saved.current), []);

  const edit = (fn: (t: Theme) => Theme) => {
    setTheme(fn);
  };
  const editSp = <K extends keyof SplashCfg>(k: K, v: SplashCfg[K]) => {
    setSp((c) => ({ ...c, [k]: v }));
  };
  // أعد تشغيل المعاينة بعد كل تغيير (بتأخير قصير كي لا تتقطّع أثناء سحب المنزلق).
  useEffect(() => {
    const t = setTimeout(() => setSpRun((n) => n + 1), 350);
    return () => clearTimeout(t);
  }, [sp]);
  async function onSplashImage(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      editSp("image", await fileToLogo(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر رفع الصورة.");
    }
  }
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

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <OwnerForm>
      <MovableSection id="appearance.presets">
      <section className="panel panel--wide auth-form" aria-labelledby="ap-h-presets">
      <h2 id="ap-h-presets">ألوان جاهزة ومعاينة</h2>
      <p className="hint">اختر لوحة جاهزة ثم عدّل أي لون بعدها. المعاينة تظهر مباشرة على هذه الصفحة ولا تُحفظ حتى تضغط «حفظ التغييرات».</p>
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
      </MovableSection>

      {(["light", "dark"] as Mode[]).map((mode) => (
        <MovableSection key={mode} id={`appearance.${mode}`}>
        <section className="panel panel--wide auth-form" aria-labelledby={`ap-h-${mode}`}>
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
        </MovableSection>
      ))}

      <MovableSection id="appearance.fonts">
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
      </MovableSection>

      <MovableSection id="appearance.splash">
      <section className="panel panel--wide auth-form" aria-labelledby="ap-h-splash">
      <h2 id="ap-h-splash">شاشة الشعار عند فتح الموقع</h2>
      <label className="check">
        <input type="checkbox" checked={splashOn} onChange={(e) => setSplashOn(e.target.checked)} />
        إظهار شاشة الشعار عند فتح الموقع
      </label>
      {splashOn && (
        <>
          <div className="splash-box" role="img" aria-label="معاينة شاشة الشعار">
            <SplashView key={spRun} settings={settings} cfg={sp} contained />
          </div>
          <div className="addrow">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSpRun((n) => n + 1)}>إعادة تشغيل المعاينة</button>
          </div>

          <div className="field">
            <span>الصورة</span>
            <div className="addrow">
              <label className="btn btn--ghost btn--sm filebtn">
                {sp.image ? "تغيير الصورة" : "رفع صورة خاصة بالشاشة"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void onSplashImage(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {sp.image && (
                <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => editSp("image", "")}>استعمال الصورة الثابتة</button>
              )}
            </div>
            <p className="hint">{sp.image ? "تُعرض صورة خاصة بهذه الشاشة." : "تُعرض الصورة الثابتة للشاشة (public/brand/splash.png). ارفع صورة هنا لاستبدالها."}</p>
          </div>
          <label className="check">
            <input type="checkbox" checked={sp.showName} onChange={(e) => editSp("showName", e.target.checked)} />
            إظهار اسم الموقع تحت الصورة
          </label>

          <div className="field">
            <label htmlFor="sp-size">حجم الصورة: {sp.size}px</label>
            <input id="sp-size" type="range" min={SPLASH_SIZE_MIN} max={SPLASH_SIZE_MAX} step={5} value={sp.size} onChange={(e) => editSp("size", Number(e.target.value))} />
            <p className="hint">الارتفاع على الشاشة الفعلية؛ المعاينة أعلاه مصغّرة.</p>
          </div>

          <div className="two">
            <div className="field">
              <label htmlFor="sp-in">طريقة الظهور</label>
              <select id="sp-in" value={sp.anim} onChange={(e) => editSp("anim", e.target.value as SplashCfg["anim"])}>
                {SPLASH_IN.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sp-motion">الحركة أثناء العرض</label>
              <select id="sp-motion" value={sp.motion} onChange={(e) => editSp("motion", e.target.value as SplashCfg["motion"])}>
                {SPLASH_MOTION.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="sp-out">طريقة الاختفاء</label>
              <select id="sp-out" value={sp.out} onChange={(e) => editSp("out", e.target.value as SplashCfg["out"])}>
                {SPLASH_OUT.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sp-dur">مدة العرض: {sp.duration.toLocaleString("ar-EG")} ثانية</label>
              <input id="sp-dur" type="range" min={SPLASH_DUR_MIN} max={SPLASH_DUR_MAX} step={0.1} value={sp.duration} onChange={(e) => editSp("duration", Number(e.target.value))} />
            </div>
          </div>

          <div className="field crow">
            <label htmlFor="sp-bg">
              لون الخلفية
              <small className="hint">الافتراضي: لون خلفية الموقع (يتبدّل مع الوضع الفاتح والداكن).</small>
            </label>
            <div className="colorrow">
              <input id="sp-bg" type="color" value={sp.bg || "#ffffff"} onChange={(e) => editSp("bg", e.target.value)} />
              <code dir="ltr">{sp.bg || "افتراضي"}</code>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => editSp("bg", "")} disabled={!sp.bg}>افتراضي</button>
            </div>
          </div>
          <div className="addrow">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSp(DEFAULT_SPLASH)}>استعادة الافتراضي لهذه الشاشة</button>
          </div>
        </>
      )}
      <p className="hint">تظهر الشاشة مرة واحدة عند فتح الموقع ثم تختفي. لا تُحفظ التغييرات حتى تضغط «حفظ التغييرات».</p>
      </section>
      </MovableSection>
    </OwnerForm>
  );
}
