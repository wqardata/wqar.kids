"use client";
import { useState } from "react";
import LoginPanel, { type Mode } from "@/app/login/LoginPanel";
import { DEFAULT_SIGNUP, SIGNUP_FIELDS, cleanLoginMethods, saveSettings, useSettings, type LoginMethods, type SignupTexts } from "@/lib/settings";
import { usePreviewDraft } from "@/lib/preview";
import { MovableSection, OwnerFooter, OwnerForm } from "./sectionKit";

const MODES: { id: Mode; label: string }[] = [
  { id: "signin", label: "تسجيل الدخول" },
  { id: "reset", label: "نسيت كلمة المرور" },
];

/** تعديل نصوص صفحة الدخول (/login) مع معاينة حيّة قبل الحفظ. */
export default function SignupTab() {
  const { settings, update, ready } = useSettings();
  const [draft, setDraft] = useState<SignupTexts>(settings.signup);
  const [methods, setMethods] = useState<LoginMethods>(settings.loginMethods);
  usePreviewDraft("signup", { signup: draft, loginMethods: cleanLoginMethods(methods) });
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const keys = SIGNUP_FIELDS.flatMap((g) => g.items.map((i) => i.key));
  const methodsDirty = methods.google !== settings.loginMethods.google || methods.email !== settings.loginMethods.email;
  const dirty = methodsDirty || keys.some((k) => draft[k] !== settings.signup[k]);
  const isDefault = keys.every((k) => draft[k] === DEFAULT_SIGNUP[k]) && methods.google && methods.email;

  const set = (k: keyof SignupTexts, v: string) => {
    setMsg("");
    setDraft((d) => ({ ...d, [k]: v }));
  };

  // لا يُسمح بإخفاء الطريقتين معًا: لن يستطيع أحد الدخول.
  const setMethod = (k: keyof LoginMethods, v: boolean) => {
    setMsg("");
    setError("");
    if (!v && !methods[k === "google" ? "email" : "google"]) {
      setError("لا يمكن إخفاء طريقتي الدخول معًا؛ أبقِ واحدة على الأقل ظاهرة.");
      return;
    }
    setMethods((m) => ({ ...m, [k]: v }));
  };

  async function save() {
    setBusy(true);
    setError("");
    setMsg("");
    // حقل فارغ = النص الافتراضي.
    const clean = { ...draft };
    for (const k of keys) if (!clean[k].trim()) clean[k] = DEFAULT_SIGNUP[k];
    try {
      const saved = await saveSettings({ ...settings, signup: clean, loginMethods: cleanLoginMethods(methods) });
      update(saved);
      setDraft(saved.signup);
      setMethods(saved.loginMethods);
      setMsg("تم حفظ نصوص التسجيل ✓");
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore (settings).");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="empty-note" role="status">جارٍ التحميل…</p>;

  return (
    <>
      <MovableSection id="signup.texts">
      <section className="panel auth-form" aria-labelledby="su-h">
        <h2 id="su-h">نصوص صفحة التسجيل {dirty && <span className="dirty-dot">● تعديلات غير محفوظة</span>}</h2>
        <p className="hint">
          تظهر هذه النصوص في صفحة «تسجيل الدخول». اكتب <code dir="ltr">{"{name}"}</code> في أي نص ليُستبدل باسم الموقع. الحقل الفارغ يعود للنص الافتراضي.
        </p>
      </section>
      </MovableSection>
      <MovableSection id="signup.methods">
      <section className="panel auth-form" aria-labelledby="su-m">
        <h2 id="su-m">طرق الدخول الظاهرة</h2>
        <label className="check"><input type="checkbox" checked={methods.google} onChange={(e) => setMethod("google", e.target.checked)} /> إظهار الدخول عبر جوجل</label>
        <label className="check"><input type="checkbox" checked={methods.email} onChange={(e) => setMethod("email", e.target.checked)} /> إظهار الدخول بالبريد الإلكتروني وكلمة المرور (ومعه «نسيت كلمة المرور»)</label>
        <p className="hint">
          يجب أن تبقى طريقة واحدة على الأقل. هذا إخفاء من واجهة صفحة الدخول فقط؛ تبقى الطريقتان مفعّلتين في Firebase، والحسابات ما تزال تُضاف من قِبل المالك فقط (قائمة «allowed»). تأكد قبل إخفاء إحداهما أن أعضاءك يستطيعون الدخول بالأخرى.
        </p>
      </section>
      </MovableSection>
      {SIGNUP_FIELDS.map((g, gi) => (
        <MovableSection key={g.group} id={`signup.g${gi}`}>
        <section className="panel auth-form" aria-labelledby={`su-g${gi}`}>
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
        </MovableSection>
      ))}

      <MovableSection id="signup.preview">
      <section className="live-preview" aria-label="معاينة قبل الحفظ">
        <header>
          <strong>معاينة قبل الحفظ</strong>
          <div className="addrow" role="group" aria-label="الشاشة المعروضة">
            {MODES.filter((m) => m.id !== "reset" || methods.email).map((m) => (
              <button key={m.id} type="button" className={`btn btn--sm ${mode === m.id ? "" : "btn--ghost"}`} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </header>
        <div className="auth">
          <LoginPanel key={`${mode}-${methods.google}-${methods.email}`} initialMode={methods.email ? mode : "signin"} preview={draft} previewMethods={methods} />
        </div>
      </section>
      </MovableSection>

      <OwnerFooter>
      {error && <p className="field-error" role="alert">{error}</p>}
      {msg && <p className="hint" role="status">{msg}</p>}
      <div className="addrow">
        <button type="button" className="btn" onClick={() => void save()} disabled={busy || !dirty}>{busy ? "جارٍ الحفظ…" : "حفظ نصوص التسجيل"}</button>
        <button type="button" className="btn btn--ghost" onClick={() => { setDraft(settings.signup); setMethods(settings.loginMethods); }} disabled={busy || !dirty}>تراجع عن التعديلات</button>
        <button type="button" className="btn btn--ghost" onClick={() => { setDraft(DEFAULT_SIGNUP); setMethods({ google: true, email: true }); }} disabled={busy || isDefault}>استعادة الافتراضي</button>
      </div>
      </OwnerFooter>
    </>
  );
}
