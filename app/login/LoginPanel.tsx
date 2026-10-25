"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { cancelGoogleSuggestion, suggestGoogleAccount } from "@/lib/googleAccounts";
import { generateStrongPassword } from "@/lib/password";
import { signupText, useSettings, type SignupTexts } from "@/lib/settings";

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export type Mode = "signin" | "signup" | "reset";

function message(e: unknown): string {
  const code = (e as { code?: string }).code ?? "unknown";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "البريد أو كلمة المرور غير صحيحة.";
    case "auth/email-already-in-use":
      return "هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول.";
    case "auth/weak-password":
      return "كلمة المرور ضعيفة (6 أحرف على الأقل).";
    case "auth/invalid-email":
      return "البريد الإلكتروني غير صالح.";
    case "auth/too-many-requests":
      return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
    case "auth/network-request-failed":
      return "تعذّر الاتصال بالإنترنت.";
    case "auth/popup-blocked":
      return "المتصفح حجب نافذة جوجل. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.";
    case "auth/unauthorized-domain":
      return "هذا الدومين غير مضاف في Firebase (Authentication ← Settings ← Authorized domains). (auth/unauthorized-domain)";
    case "auth/web-storage-unsupported":
    case "auth/operation-not-supported-in-this-environment":
      return "متصفحك لا يدعم الدخول هنا (تصفح خاص أو متصفح داخل تطبيق). افتح الرابط في Chrome أو Safari.";
    case "auth/operation-not-allowed":
      return "التسجيل بالبريد وكلمة المرور غير مفعّل في Firebase بعد (Authentication ← Sign-in method ← Email/Password).";
    case "app/profile-failed":
    case "permission-denied":
    case "firestore/permission-denied":
      return "أُنشئ حسابك لكن تعذّر حفظ ملفك في الموقع (صلاحيات Firestore). تأكد أن firestore.rules المحدّث منشور (قسم users)، ثم سجّل الخروج والدخول من جديد.";
    default:
      return `تعذّرت العملية. حاول مرة أخرى. (${code})`;
  }
}

/**
 * `preview`: معاينة لوحة التحكم — تعرض الصفحة بالنصوص المعطاة (قبل حفظها) دون أي تفاعل أو تحويل أو اتصال بالحساب.
 */
export default function LoginPanel({ initialMode = "signin", preview }: { initialMode?: Mode; preview?: SignupTexts }) {
  const { settings } = useSettings();
  const T = preview ?? settings.signup;
  const tx = (t: string) => signupText(t, settings.siteName);
  const { user: realUser, loading, configured: realConfigured, canAdd, banned, signIn, signOut, signInEmail, signUpEmail, resetPassword } = useAuth();
  const user = preview ? null : realUser;
  const configured = preview ? true : realConfigured;
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPw, setShowPw] = useState(false);
  // كلمة المرور القوية المقترحة (تظهر عند الضغط على خانة كلمة المرور في التسجيل) وهل اعتمدها المستخدم.
  const [suggestion, setSuggestion] = useState("");
  const [usedSuggestion, setUsedSuggestion] = useState(false);
  const [copied, setCopied] = useState(false);
  const askedAccount = useRef(false);

  // بعد الدخول (وبعد تحميل صلاحياته): المشرف يذهب للوحة التحكم، وأي مشاهد آخر للرئيسية.
  // (لا نحوّل أثناء تنفيذ التسجيل نفسه، كي يكتمل حفظ سجل العضو قبل مغادرة الصفحة.)
  useEffect(() => {
    if (user && !loading && !busy && !error) router.replace(canAdd ? "/admin" : "/");
  }, [user, loading, busy, error, canAdd, router]);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setInfo("");
    setSuggestion("");
    setUsedSuggestion(false);
    setShowPw(false);
    askedAccount.current = false;
    cancelGoogleSuggestion();
  }

  // أول ضغطة على خانة البريد عند التسجيل: يقترح المتصفح حساب جوجل الموجود فيه ويملأ البريد (والاسم) تلقائيًا.
  function onEmailFocus() {
    if (mode !== "signup" || email || askedAccount.current) return;
    askedAccount.current = true;
    void suggestGoogleAccount((p) => {
      setEmail(p.email);
      setName((n) => n || p.name.slice(0, 60));
    });
  }

  // ضغطة على خانة كلمة المرور عند التسجيل: نقترح كلمة قوية (لا نفرضها).
  function onPasswordFocus() {
    if (mode === "signup" && !password && !usedSuggestion) setSuggestion((s) => s || generateStrongPassword());
  }

  function applySuggestion() {
    setPassword(suggestion);
    setShowPw(true); // يرى كلمة المرور ليحفظها
    setUsedSuggestion(true);
    setSuggestion("");
  }

  async function copySuggestion(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* النسخ غير متاح: يستطيع تحديد النص يدويًا */
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      if (mode === "signin") await signInEmail(email, password);
      else if (mode === "signup") await signUpEmail(name, email, password);
      else {
        await resetPassword(email);
        setInfo(tx(T.resetDone));
      }
    });
  }

  if (!configured) {
    return (
      <>
      <h1>{tx(T.title)}</h1>
      <p className="note" role="status">
        لم يُضبط Firebase بعد. انسخ <code>.env.example</code> إلى <code>.env.local</code> واملأ القيم (التفاصيل في README).
      </p>
      </>
    );
  }

  if (user) {
    return (
      <div>
        <h1>{tx(T.title)}</h1>
        {error ? <p className="field-error" role="alert">{error}</p> : <p className="note" role="status">جارٍ تحويلك… ({user.email})</p>}
        <button type="button" className="btn btn--ghost" onClick={() => void signOut()}>تسجيل الخروج</button>
      </div>
    );
  }

  return (
    <div {...(preview ? { inert: true } : {})}>
      <h1>{tx(T.title)}</h1>
      <p className="note">{tx(mode === "signup" ? T.noteSignup : mode === "reset" ? T.noteReset : T.noteSignin)}</p>

      {mode !== "reset" && (
        <>
          <button type="button" className="gbtn" onClick={() => void run(signIn)} disabled={busy || loading}>
            <GoogleLogo />
            <span>{busy ? "جارٍ الاتصال…" : tx(T.google)}</span>
          </button>
          <p className="or" aria-hidden="true"><span>{tx(T.or)}</span></p>
        </>
      )}

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === "signup" && (
          <label>
            {tx(T.nameLabel)}
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
          </label>
        )}
        <label>
          {tx(T.emailLabel)}
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={onEmailFocus} required autoComplete={mode === "signup" ? "email" : "username"} />
        </label>
        {mode !== "reset" && (
          <>
            <label>
              {tx(T.passwordLabel)}
              <input
                type={showPw ? "text" : "password"}
                dir="ltr"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSuggestion("");
                  setUsedSuggestion(false);
                }}
                onFocus={onPasswordFocus}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </label>
            <button type="button" className="linkbtn linkbtn--sm" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}>
              {showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            </button>
            {mode === "signup" && suggestion && (
              <div className="pw-suggest" role="region" aria-label="اقتراح كلمة مرور قوية">
                <p>كلمة مرور قوية مقترحة لك:</p>
                <code dir="ltr">{suggestion}</code>
                <div className="addrow">
                  <button type="button" className="btn btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={applySuggestion}>استخدامها</button>
                  <button type="button" className="btn btn--ghost btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => setSuggestion(generateStrongPassword())}>اقتراح آخر</button>
                  <button type="button" className="btn btn--ghost btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => void copySuggestion(suggestion)}>{copied ? "تم النسخ ✓" : "نسخ"}</button>
                </div>
                <p className="hint">مجرد اقتراح: يمكنك كتابة كلمة مرور من اختيارك، ويمكنك تغييرها في أي وقت من صفحة «حسابي» بعد التسجيل.</p>
              </div>
            )}
            {mode === "signup" && usedSuggestion && password && (
              <p className="hint pw-used" role="status">
                تم تعيين كلمة المرور المقترحة. احفظها الآن (
                <button type="button" className="linkbtn linkbtn--sm" onClick={() => void copySuggestion(password)}>{copied ? "تم النسخ ✓" : "نسخ"}</button>
                ). يمكنك تغييرها لاحقًا من «حسابي».
              </p>
            )}
          </>
        )}
        {banned && !error && <p className="field-error" role="alert">تم إيقاف هذا الحساب من قِبل إدارة الموقع. تواصل معنا إن كان ذلك خطأ.</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
        {info && <p className="hint" role="status">{info}</p>}
        <button type="submit" disabled={busy || loading}>
          {busy ? "جارٍ التنفيذ…" : tx(mode === "signin" ? T.submitSignin : mode === "signup" ? T.submitSignup : T.submitReset)}
        </button>
      </form>

      <p className="switch">
        {mode === "signin" && (
          <>
            <button type="button" className="linkbtn" onClick={() => switchMode("signup")}>{tx(T.toSignup)}</button>
            <button type="button" className="linkbtn" onClick={() => switchMode("reset")}>{tx(T.forgot)}</button>
          </>
        )}
        {mode !== "signin" && (
          <button type="button" className="linkbtn" onClick={() => switchMode("signin")}>{tx(T.toSignin)}</button>
        )}
      </p>
    </div>
  );
}
