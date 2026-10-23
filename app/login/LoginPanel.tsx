"use client";
import { useEffect, useState } from "react";
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

export default function LoginPanel() {
  const { user, loading, configured, canAdd, signIn, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // بعد الدخول: المخوَّل يذهب للوحة التحكم، وغيره للرئيسية.
  useEffect(() => {
    if (user) router.replace(canAdd ? "/admin" : "/");
  }, [user, canAdd, router]);

  async function go() {
    setBusy(true);
    setError("");
    try {
      await signIn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError("تعذّر تسجيل الدخول. تأكد من السماح بالنوافذ المنبثقة وحاول مرة أخرى.");
      }
    } finally {
      setBusy(false);
    }
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
      <p className="note">سجّل الدخول أو أنشئ حسابًا بنقرة واحدة باستخدام حساب جوجل.</p>
      <button type="button" className="gbtn" onClick={() => void go()} disabled={busy || loading}>
        <GoogleLogo />
        <span>{busy ? "جارٍ الاتصال…" : "المتابعة باستخدام جوجل"}</span>
      </button>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
