"use client";
import { useState } from "react";
import LoginPanel, { type Mode } from "@/app/login/LoginPanel";
import { DEFAULT_SIGNUP, SIGNUP_FIELDS, saveSettings, useSettings, type SignupTexts } from "@/lib/settings";

const MODES: { id: Mode; label: string }[] = [
  { id: "signin", label: "تسجيل الدخول" },
  { id: "reset", label: "نسيت كلمة المرور" },
];

/** تعديل نصوص صفحة الدخول (/login) مع معاينة حيّة قبل الحفظ. */
export default function SignupTab() {
  const { settings, update, ready } = useSettings();
  const [draft, setDraft] = useState<SignupTexts>(settings.signup);
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const keys = SIGNUP_FIELDS.flatMap((g) => g.items.map((i) => i.key));
  const dirty = keys.some((k) => draft[k] !== settings.signup[k]);
  const isDefault = keys.every((k) => draft[k] === DEFAULT_SIGNUP[k]);

  const set = (k: keyof SignupTexts, v: string) => {
    setMsg("");
    setDraft((d) => ({ ...d, [k]: v }));
  };

  async function save() {
    setBusy(true);
    setError("");
    setMsg("");
    // حقل فارغ = النص الافتراضي.
    const clean = { ...draft };
    for (const k of keys) if (!clean[k].trim()) clean[k] = DEFAULT_SIGNUP[k];
    try {
      const saved = await saveSettings({ ...settings, signup: clean });
      update(saved);
      setDraft(saved.signup);
      setMsg("تم حفظ نصوص التسجيل ✓");
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <div className="admin-stack">
      <section className="panel auth-form" aria-labelledby="su-h">
        <h2 id="su-h">نصوص صفحة التسجيل {dirty && <span className="dirty-dot">● تعديلات غير محفوظة</span>}</h2>
        <p className="hint">
          تظهر هذه النصوص في صفحة «تسجيل الدخول». اكتب <code dir="ltr">{"{name}"}</code> في أي نص ليُستبدل باسم الموقع. الحقل الفارغ يعود للنص الافتراضي.
        </p>
      </section>
      {SIGNUP_FIELDS.map((g, gi) => (
        <section key={g.group} className="panel auth-form" aria-labelledby={`su-g${gi}`}>
          <h2 id={`su-g${gi}`}>{g.group}</h2>
          {g.items.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`su-${f.key}`}>{f.label}</label>
              {f.long ? (
                <textarea id={`su-${f.key}`} rows={2} value={draft[f.key]} maxLength={f.max} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input id={`su-${f.key}`} value={draft[f.key]} maxLength={f.max} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {draft[f.key] !== DEFAULT_SIGNUP[f.key] && (
                <div className="live-vars">
                  <button type="button" className="linkbtn linkbtn--sm" onClick={() => set(f.key, DEFAULT_SIGNUP[f.key])}>الافتراضي</button>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}

      <section className="live-preview" aria-label="معاينة قبل الحفظ">
        <header>
          <strong>معاينة قبل الحفظ</strong>
          <div className="addrow" role="group" aria-label="الشاشة المعروضة">
            {MODES.map((m) => (
              <button key={m.id} type="button" className={`btn btn--sm ${mode === m.id ? "" : "btn--ghost"}`} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </header>
        <div className="auth">
          <LoginPanel key={mode} initialMode={mode} preview={draft} />
        </div>
      </section>

      {error && <p className="field-error" role="alert">{error}</p>}
      {msg && <p className="hint" role="status">{msg}</p>}
      <div className="addrow">
        <button type="button" className="btn" onClick={() => void save()} disabled={busy || !dirty}>{busy ? "جارٍ الحفظ…" : "حفظ نصوص التسجيل"}</button>
        <button type="button" className="btn btn--ghost" onClick={() => setDraft(settings.signup)} disabled={busy || !dirty}>تراجع عن التعديلات</button>
        <button type="button" className="btn btn--ghost" onClick={() => setDraft(DEFAULT_SIGNUP)} disabled={busy || isDefault}>استعادة الافتراضي</button>
      </div>
    </div>
  );
}
