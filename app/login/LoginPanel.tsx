"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

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

type Mode = "signin" | "signup" | "reset";

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
    default:
      return `تعذّرت العملية. حاول مرة أخرى. (${code})`;
  }
}

export default function LoginPanel() {
  const { user, loading, configured, canAdd, signIn, signOut, signInEmail, signUpEmail, resetPassword } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // بعد الدخول: المشرف يذهب للوحة التحكم، وأي مشاهد آخر للرئيسية.
  useEffect(() => {
    if (user) router.replace(canAdd ? "/admin" : "/");
  }, [user, canAdd, router]);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setInfo("");
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
        setInfo("إن كان البريد مسجّلًا فسيصلك رابط لإعادة تعيين كلمة المرور. تفقّد أيضًا البريد المزعج.");
      }
    });
  }

  if (!configured) {
    return (
      <p className="note" role="status">
        لم يُضبط Firebase بعد. انسخ <code>.env.example</code> إلى <code>.env.local</code> واملأ القيم (التفاصيل في README).
      </p>
    );
  }

  if (user) {
    return (
      <div>
        <p className="note" role="status">جارٍ تحويلك… ({user.email})</p>
        <button type="button" className="btn btn--ghost" onClick={() => void signOut()}>تسجيل الخروج</button>
      </div>
    );
  }

  return (
    <div>
      <p className="note">
        {mode === "signup"
          ? "أنشئ حسابًا مجانيًا للمشاهدة. رفع الفيديوهات وإدارة الموقع للمشرف فقط."
          : mode === "reset"
            ? "اكتب بريدك لنرسل لك رابط إعادة تعيين كلمة المرور."
            : "سجّل الدخول، أو أنشئ حسابًا جديدًا للمشاهدة."}
      </p>

      {mode !== "reset" && (
        <>
          <button type="button" className="gbtn" onClick={() => void run(signIn)} disabled={busy || loading}>
            <GoogleLogo />
            <span>{busy ? "جارٍ الاتصال…" : "المتابعة باستخدام جوجل"}</span>
          </button>
          <p className="or" aria-hidden="true"><span>أو بالبريد الإلكتروني</span></p>
        </>
      )}

      <form className="auth-form" onSubmit={onSubmit}>
        {mode === "signup" && (
          <label>
            الاسم (اختياري)
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
          </label>
        )}
        <label>
          البريد الإلكتروني
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        {mode !== "reset" && (
          <label>
            كلمة المرور
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
        {info && <p className="hint" role="status">{info}</p>}
        <button type="submit" disabled={busy || loading}>
          {busy ? "جارٍ التنفيذ…" : mode === "signin" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب" : "إرسال الرابط"}
        </button>
      </form>

      <p className="switch">
        {mode === "signin" && (
          <>
            <button type="button" className="linkbtn" onClick={() => switchMode("signup")}>ليس لديك حساب؟ أنشئ حسابًا</button>
            <button type="button" className="linkbtn" onClick={() => switchMode("reset")}>نسيت كلمة المرور؟</button>
          </>
        )}
        {mode !== "signin" && (
          <button type="button" className="linkbtn" onClick={() => switchMode("signin")}>لديك حساب؟ سجّل الدخول</button>
        )}
      </p>
    </div>
  );
}
