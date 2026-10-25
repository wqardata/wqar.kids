"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, updateDoc } from "firebase/firestore";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/lib/auth";
import { getDb, isOwnerEmail } from "@/lib/firebase";
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

  useEffect(() => {
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

  const admins = items.filter((m) => m.role === "admin").length;
  const banned = items.filter((m) => m.banned).length;

  return (
    <div className="members">
      <p className="hint">
        {items.length} عضو • {admins} مشرف • {banned} محظور. يظهر العضو هنا بعد أول دخول له. المالكون (بريداتهم في <code>ADMIN_EMAILS</code>) لا يُعدَّلون من هنا.
      </p>
      <div className="field admin-search">
        <input type="search" aria-label="بحث في الأعضاء" placeholder="ابحث بالاسم أو البريد" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {loading ? (
        <p className="empty-note" role="status">جارٍ التحميل…</p>
      ) : shown.length === 0 ? (
        <p className="empty-note">{items.length === 0 ? "لا يوجد أعضاء مسجَّلون بعد." : "لا نتائج."}</p>
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
                      if (!window.confirm(`إزالة «${m.name || m.email}» من قائمة الأعضاء؟\nيُحذف سجله وصلاحياته. إن سجّل دخوله مجددًا يُضاف عضوًا جديدًا بصلاحية «مشاهد». للمنع الدائم استعمل «حظر».`)) return;
                      void run(m.uid, () => deleteDoc(doc(getDb(), "users", m.uid)), () => setItems((prev) => prev.filter((x) => x.uid !== m.uid)));
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
