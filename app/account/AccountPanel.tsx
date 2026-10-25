"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { AVATARS, avatarById } from "@/lib/avatars";
import { ROLE_LABEL } from "@/lib/members";
import { generateStrongPassword } from "@/lib/password";

function pwMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? "unknown";
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "كلمة المرور الحالية غير صحيحة.";
    case "auth/weak-password":
      return "كلمة المرور الجديدة ضعيفة (6 أحرف على الأقل).";
    case "auth/requires-recent-login":
      return "لأسباب أمنية سجّل الخروج ثم الدخول مجددًا وأعد المحاولة.";
    case "auth/too-many-requests":
      return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
    case "auth/network-request-failed":
      return "تعذّر الاتصال بالإنترنت.";
    default:
      return `تعذّر تغيير كلمة المرور. (${code})`;
  }
}

export default function AccountPanel() {
  const { user, profile, loading, configured, canAdd, hasPassword, signOut, saveAccount, changePassword } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  if (!configured) return <p className="note">لم يُضبط Firebase بعد — راجع README.</p>;
  if (loading) return <p className="note" role="status">جارٍ التحميل…</p>;
  if (!user) {
    return (
      <>
        <p className="note">سجّل الدخول لإدارة حسابك.</p>
        <Link href="/login" className="btn">تسجيل الدخول</Link>
      </>
    );
  }

  const shownName = name ?? profile?.name ?? user.displayName ?? "";
  const avatarId = profile?.avatar || AVATARS[0].id;

  async function persist(patch: { name?: string; avatar?: string }, ok: string) {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await saveAccount(patch);
      setMsg(ok);
    } catch {
      setErr("تعذّر الحفظ. تأكد من تحديث قواعد Firestore (users) ثم حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwErr("");
    setPwMsg("");
    try {
      await changePassword(cur, next);
      setPwMsg("تم تغيير كلمة المرور ✓");
      setCur("");
      setNext("");
      setShowNext(false);
    } catch (e2) {
      setPwErr(pwMessage(e2));
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="account">
      <p><Link href="/adhan" className="btn btn--ghost btn--sm">إعدادات الأذان الخاصة بي</Link></p>
      <section className="account-head">
        <Avatar id={avatarId} size={72} />
        <div>
          <strong>{shownName || "عضو"}</strong>
          <small dir="ltr" style={{ display: "block", textAlign: "start" }}>{user.email}</small>
          <small>{canAdd ? "مشرف" : ROLE_LABEL[profile?.role ?? "viewer"]}</small>
        </div>
      </section>

      <section>
        <h2>الصورة الرمزية</h2>
        <div className="avatar-grid" role="radiogroup" aria-label="اختر صورة رمزية">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={avatarId === a.id}
              aria-label={a.label}
              title={a.label}
              disabled={busy}
              className={avatarId === a.id ? "avatar-opt on" : "avatar-opt"}
              onClick={() => void persist({ avatar: a.id }, `تم اختيار «${avatarById(a.id).label}» ✓`)}
            >
              <Avatar id={a.id} size={44} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>الاسم</h2>
        <form className="addrow" onSubmit={(e) => { e.preventDefault(); void persist({ name: shownName }, "تم حفظ الاسم ✓"); }}>
          <input aria-label="الاسم" value={shownName} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <button type="submit" className="btn btn--sm" disabled={busy}>حفظ</button>
        </form>
        {msg && <p className="hint" role="status">{msg}</p>}
        {err && <p className="field-error" role="alert">{err}</p>}
      </section>

      <section>
        <h2>كلمة المرور</h2>
        {hasPassword ? (
          <form className="auth-form" onSubmit={(e) => void onPassword(e)}>
            <label>
              كلمة المرور الحالية
              <input type="password" dir="ltr" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" />
            </label>
            <label>
              كلمة المرور الجديدة
              <input type={showNext ? "text" : "password"} dir="ltr" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} autoComplete="new-password" />
            </label>
            <div className="addrow">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setNext(generateStrongPassword()); setShowNext(true); }}>اقتراح كلمة قوية</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowNext((v) => !v)} aria-pressed={showNext}>{showNext ? "إخفاء" : "إظهار"}</button>
            </div>
            {pwErr && <p className="field-error" role="alert">{pwErr}</p>}
            {pwMsg && <p className="hint" role="status">{pwMsg}</p>}
            <button type="submit" disabled={pwBusy}>{pwBusy ? "جارٍ التغيير…" : "تغيير كلمة المرور"}</button>
          </form>
        ) : (
          <p className="hint">حسابك مرتبط بجوجل، فكلمة المرور تُدار من حساب جوجل نفسه.</p>
        )}
      </section>

      <div className="addrow">
        {canAdd && <Link href="/admin" className="btn btn--sm">لوحة التحكم</Link>}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => void signOut()}>تسجيل الخروج</button>
      </div>
    </div>
  );
}
