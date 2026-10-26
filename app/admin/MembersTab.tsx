"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, updateDoc } from "firebase/firestore";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { getDb, isOwnerEmail } from "@/lib/firebase";
import { addMember, removeAllowed, EMAIL_RE } from "@/lib/memberAdmin";
import { generateStrongPassword } from "@/lib/password";
import { ROLE_LABEL, ROLE_PERMS, toProfile, type Profile, type Role } from "@/lib/members";

const when = (t: number | null) => (t ? new Date(t).toLocaleDateString("ar", { dateStyle: "medium" }) : "—");

/** الأعضاء المسجَّلون وصلاحياتهم (للمالك فقط). */
export default function MembersTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  // قائمة المسموح لهم بالدخول (allowed/{email}) وحقول نموذج الإضافة.
  const [allowed, setAllowed] = useState<{ email: string; name: string }[]>([]);
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPass, setNPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState("");
  const [addErr, setAddErr] = useState("");

  const loadAllowed = () =>
    getDocs(collection(getDb(), "allowed"))
      .then((snap) => setAllowed(snap.docs.map((d) => ({ email: d.id, name: typeof d.data().name === "string" ? (d.data().name as string) : "" }))))
      .catch(() => {});

  useEffect(() => {
    void loadAllowed();
    let off = false;
    getDocs(query(collection(getDb(), "users"), orderBy("createdAt", "desc"), limit(500)))
      .then((snap) => !off && setItems(snap.docs.map((d) => toProfile(d.id, d.data()))))
      .catch(() => !off && setError("تعذّر تحميل الأعضاء. تأكد أنك لصقت firestore.rules المحدّث (فيه users) وأن بريدك فيه ضمن المالكين، ثم Publish."))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, []);

  async function run(uid: string, fn: () => Promise<void>, after: () => void) {
    setBusy(uid);
    setError("");
    try {
      await fn();
      after();
    } catch {
      setError("تعذّر تنفيذ العملية. تأكد من الصلاحيات وقواعد Firestore.");
    } finally {
      setBusy("");
    }
  }

  const patch = (uid: string, p: Partial<Profile>) => setItems((prev) => prev.map((m) => (m.uid === uid ? { ...m, ...p } : m)));

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(t)) : items;
  }, [items, q]);

  const shownEmails = useMemo(() => new Set(items.map((m) => m.email.toLowerCase())), [items]);
  const pending = allowed.filter((a) => !shownEmails.has(a.email));

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setAddErr("");
    setAddMsg("");
    const email = nEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return setAddErr("اكتب بريدًا إلكترونيًا صحيحًا.");
    if (nPass && nPass.length < 6) return setAddErr("كلمة المرور 6 أحرف على الأقل (أو اتركها فارغة ليدخل بجوجل).");
    setAdding(true);
    try {
      const r = await addMember({ name: nName, email, password: nPass });
      setAddMsg(
        r.createdAccount
          ? `أُضيف «${email}» وأُنشئ حسابه. سلّمه كلمة المرور؛ وصله أيضًا رابط لتأكيد بريده.`
          : r.existed
            ? `أُضيف «${email}» إلى القائمة. له حساب سابق في Firebase فيدخل به (كلمة مروره القديمة أو جوجل).`
            : `أُضيف «${email}». يدخل بحساب جوجل بهذا البريد.`,
      );
      setNName("");
      setNEmail("");
      setNPass("");
      setShowPass(false);
      void loadAllowed();
      getDocs(query(collection(getDb(), "users"), orderBy("createdAt", "desc"), limit(500))).then((snap) => setItems(snap.docs.map((d) => toProfile(d.id, d.data())))).catch(() => {});
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setAddErr(
        code === "auth/weak-password" ? "كلمة المرور ضعيفة (6 أحرف على الأقل)."
          : code === "auth/operation-not-allowed" ? "فعّل Email/Password في Firebase (Authentication ← Sign-in method)."
          : code === "auth/admin-restricted-operation" ? "إنشاء الحسابات معطّل في Firebase (Authentication ← Settings ← User actions ← فعّل Enable create)."
          : code.includes("permission") ? "رُفضت الصلاحية. تأكد أنك المالك وأن firestore.rules المحدّث منشور (قسم allowed)."
          : "تعذّرت الإضافة. حاول مرة أخرى.",
      );
    } finally {
      setAdding(false);
    }
  }

  const admins = items.filter((m) => m.role === "admin").length;
  const banned = items.filter((m) => m.banned).length;

  return (
    <div className="members">
      <section className="panel auth-form" aria-labelledby="mb-add">
        <h2 id="mb-add">إضافة عضو جديد</h2>
        <p className="hint">التسجيل الذاتي مُغلق: لا يدخل الموقع إلا من تضيفه هنا. اترك كلمة المرور فارغة إن كان سيدخل بحساب جوجل.</p>
        <form onSubmit={(e) => void onAdd(e)}>
          <label>
            الاسم (اختياري)
            <input type="text" value={nName} onChange={(e) => setNName(e.target.value)} maxLength={60} autoComplete="off" />
          </label>
          <label>
            البريد الإلكتروني
            <input type="email" dir="ltr" value={nEmail} onChange={(e) => setNEmail(e.target.value)} required autoComplete="off" />
          </label>
          <label>
            كلمة المرور (اختياري)
            <input type={showPass ? "text" : "password"} dir="ltr" value={nPass} onChange={(e) => setNPass(e.target.value)} autoComplete="new-password" />
          </label>
          <div className="addrow">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setNPass(generateStrongPassword()); setShowPass(true); }}>اقتراح كلمة قوية</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowPass((v) => !v)} aria-pressed={showPass}>{showPass ? "إخفاء" : "إظهار"}</button>
          </div>
          {addErr && <p className="field-error" role="alert">{addErr}</p>}
          {addMsg && <p className="hint" role="status">{addMsg}</p>}
          <button type="submit" className="btn" disabled={adding}>{adding ? "جارٍ الإضافة…" : "إضافة العضو"}</button>
        </form>
        {pending.length > 0 && (
          <>
            <h3>بانتظار أول دخول ({pending.length})</h3>
            <ul className="alist">
              {pending.map((a) => (
                <li key={a.email} className="arow">
                  <div className="arow-info">
                    <strong>{a.name || "بدون اسم"}</strong>
                    <small dir="ltr" style={{ textAlign: "start" }}>{a.email}</small>
                  </div>
                  <div className="arow-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm danger"
                      onClick={() => {
                        if (!window.confirm(`إزالة «${a.email}» من القائمة؟ لن يستطيع الدخول.`)) return;
                        void removeAllowed(a.email).then(() => setAllowed((p) => p.filter((x) => x.email !== a.email))).catch(() => setError("تعذّرت الإزالة."));
                      }}
                    >
                      إزالة
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <p className="hint">
        {items.length} عضو • {admins} مشرف • {banned} محظور. المالكون (بريداتهم في <code>ADMIN_EMAILS</code>) لا يُعدَّلون من هنا.
      </p>
      <div className="field admin-search">
        <input type="search" aria-label="بحث في الأعضاء" placeholder="ابحث بالاسم أو البريد" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {loading ? (
        <p className="empty-note" role="status">جارٍ التحميل…</p>
      ) : shown.length === 0 ? (
        <p className="empty-note">{items.length === 0 ? "لا يوجد أعضاء بعد." : "لا نتائج."}</p>
      ) : (
        <ul className="alist">
          {shown.map((m) => {
            const owner = isOwnerEmail(m.email);
            const me = m.uid === user?.uid;
            const locked = owner || me;
            return (
              <li key={m.uid} className="arow member-row">
                <Avatar id={m.avatar} size={44} />
                <div className="arow-info">
                  <strong>{m.name || "بدون اسم"}{me && " (أنت)"}</strong>
                  <small dir="ltr" style={{ textAlign: "start" }}>{m.email}</small>
                  <small>
                    انضم {when(m.createdAt)} • آخر دخول {when(m.lastLoginAt)}
                  </small>
                  <span className="badges">
                    {owner && <b className="badge">مالك</b>}
                    {!owner && <b className={m.role === "admin" ? "badge" : "badge badge--off"}>{ROLE_LABEL[m.role]}</b>}
                    {m.banned && <b className="badge badge--ban">محظور</b>}
                  </span>
                  <small className="perm">
                    {owner ? "كل الصلاحيات + إدارة الأعضاء" : ROLE_PERMS[m.role]}
                  </small>
                </div>
                <div className="arow-actions">
                  <label className="visually-label">
                    <span className="sr-only">صلاحية {m.name || m.email}</span>
                    <select
                      value={m.role}
                      disabled={locked || busy === m.uid}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        void run(m.uid, () => updateDoc(doc(getDb(), "users", m.uid), { role }), () => patch(m.uid, { role }));
                      }}
                    >
                      <option value="viewer">{ROLE_LABEL.viewer}</option>
                      <option value="admin">{ROLE_LABEL.admin}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={locked || busy === m.uid}
                    title={m.banned ? "السماح له بالدخول مجددًا" : "يُخرَج من حسابه تلقائيًا ولا يستطيع الدخول"}
                    onClick={() => void run(m.uid, () => updateDoc(doc(getDb(), "users", m.uid), { banned: !m.banned }), () => patch(m.uid, { banned: !m.banned }))}
                  >
                    {m.banned ? "رفع الحظر" : "حظر"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm danger"
                    disabled={locked || busy === m.uid}
                    onClick={() => {
                      if (!window.confirm(`إزالة «${m.name || m.email}» من الموقع؟\nيُحذف سجله وصلاحياته ويُزال من قائمة المسموح لهم، فلا يستطيع الدخول إلا إن أضفته من جديد. (حسابه في Firebase Authentication يبقى؛ يمكنك حذفه من لوحة Firebase.)`)) return;
                      void run(m.uid, async () => {
                        await deleteDoc(doc(getDb(), "users", m.uid));
                        await removeAllowed(m.email).catch(() => {});
                      }, () => setItems((prev) => prev.filter((x) => x.uid !== m.uid)));
                    }}
                  >
                    إزالة
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="hint">
        صلاحية «مشرف» تفتح لوحة التحكم (الفيديوهات، البلاغات، المظهر، الإعدادات) ولا تفتح هذه الصفحة. تعمل فقط لمن بريده موثّق. للحظر الدائم أو لحذف الحساب نفسه من Firebase افتح Authentication في لوحة Firebase.
      </p>
    </div>
  );
}
