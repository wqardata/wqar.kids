"use client";
import { bumpVideosVersion } from "@/lib/videos";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, query, serverTimestamp, updateDoc, where, type QueryDocumentSnapshot } from "firebase/firestore";
import { USE_NEON } from "@/lib/backend";
import { getDb } from "@/lib/firebase";
import { adminHideFromReport, adminReportOp, adminReports } from "@/lib/neonAdminClient";
import { useRefreshOnReturn } from "@/lib/notifications";

type Report = { id: string; videoId: string; videoTitle: string; reason: string; note: string; status: "open" | "done"; at: number | null };

export default function ReportsTab() {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [showDone, setShowDone] = useState(false);

  // نستعلم بنفس شرط عدّاد الجرس (status == open) دون orderBy: بلاغ بلا createdAt كان يُعدّ في الجرس ويغيب هنا.
  // الاشتراك مباشر (يظهر البلاغ الجديد فورًا) + تحديث صريح عند عودة التطبيق من الخلفية لأن الاشتراك يتجمّد في الجوال.
  const reload = useCallback(() => {
    const toReport = (d: QueryDocumentSnapshot): Report => {
      const x = d.data();
      const s = (k: string) => (typeof x[k] === "string" ? (x[k] as string) : "");
      const t = x.createdAt as { toMillis?: () => number } | null;
      return {
        id: d.id,
        videoId: s("videoId"),
        videoTitle: s("videoTitle"),
        reason: s("reason"),
        note: s("note"),
        status: x.status === "done" ? "done" : "open",
        at: t && typeof t.toMillis === "function" ? t.toMillis() : null,
      };
    };
    if (USE_NEON) {
      adminReports(showDone)
        .then((list) => { setItems(list); setError(""); })
        .catch(() => setError("تعذّر تحميل البلاغات."))
        .finally(() => setLoading(false));
      return;
    }
    const q = (status: string) => getDocs(query(collection(getDb(), "reports"), where("status", "==", status), limit(200)));
    Promise.all([q("open"), showDone ? q("done") : Promise.resolve(null)])
      .then(([o, dn]) => {
        setItems([...o.docs, ...(dn?.docs ?? [])].map(toReport));
        setError("");
      })
      .catch(() => setError("تعذّر تحميل البلاغات. تأكد من قواعد Firestore (reports)."))
      .finally(() => setLoading(false));
  }, [showDone]);

  useEffect(() => {
    reload();
    if (USE_NEON) return; // لا اشتراك مباشر على Neon: التحديث عند العودة للتطبيق وكل 15 ثانية (useRefreshOnReturn أدناه)
    // أي تغيير في البلاغات المفتوحة (بلاغ جديد من زائر) = إعادة جلب القائمة.
    let first = true;
    const unsub = onSnapshot(
      query(collection(getDb(), "reports"), where("status", "==", "open")),
      () => {
        if (first) { first = false; return; }
        reload();
      },
      () => {},
    );
    return unsub;
  }, [reload]);
  useRefreshOnReturn(reload, true, 15_000);

  async function run(id: string, fn: () => Promise<void>, after: () => void) {
    setBusy(id);
    setError("");
    try {
      await fn();
      after();
    } catch {
      setError("تعذّر تنفيذ العملية. تأكد من الصلاحيات.");
    } finally {
      setBusy("");
    }
  }

  const open = items.filter((r) => r.status === "open").length;

  const shown = items.filter((r) => showDone || r.status === "open").sort((a, b) => (b.at ?? Number.MAX_SAFE_INTEGER) - (a.at ?? Number.MAX_SAFE_INTEGER));

  return (
    <div className="panel">
      <h2>البلاغات{open > 0 && ` (${open} جديد)`}</h2>
      <button type="button" className="btn btn--ghost btn--sm" onClick={reload}>تحديث</button>
      <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> إظهار البلاغات المعالَجة</label>
      {error && <p className="field-error" role="alert">{error}</p>}
      {loading ? (
        <p className="empty-note" role="status">جارٍ التحميل…</p>
      ) : shown.length === 0 ? (
        <p className="empty-note">لا توجد بلاغات.</p>
      ) : (
        <ul className="alist">
          {shown.map((r) => (
            <li key={r.id} className="arow report-row">
              <div className="arow-info">
                <Link href={`/v/${r.videoId}`}><strong>{r.videoTitle || r.videoId}</strong></Link>
                <small>{r.reason}{r.at ? ` • ${new Date(r.at).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}` : ""}</small>
                {r.note && <p className="desc-note">{r.note}</p>}
                <span className="badges">{r.status === "done" ? <b className="badge badge--off">معالَج</b> : <b className="badge">جديد</b>}</span>
              </div>
              <div className="arow-actions">
                {r.status === "open" && (
                  <button type="button" className="btn btn--ghost btn--sm" disabled={busy === r.id}
                    onClick={() => void run(r.id, () => (USE_NEON ? adminReportOp("done", r.id) : updateDoc(doc(getDb(), "reports", r.id), { status: "done", updatedAt: serverTimestamp() })), () => setItems((p) => p.map((x) => (x.id === r.id ? { ...x, status: "done" } : x))))}>
                    تمت المعالجة
                  </button>
                )}
                <button type="button" className="btn btn--ghost btn--sm" disabled={busy === r.id}
                  onClick={() => void run(r.id, () => (USE_NEON ? adminHideFromReport(r.id, r.videoId) : updateDoc(doc(getDb(), "videos", r.videoId), { hidden: true, updatedAt: serverTimestamp() })).then(() => bumpVideosVersion()), () => {})}
                  title="يخفي الفيديو عن الزوار">
                  إخفاء الفيديو
                </button>
                <button type="button" className="btn btn--ghost btn--sm danger" disabled={busy === r.id}
                  onClick={() => void run(r.id, () => (USE_NEON ? adminReportOp("delete", r.id) : deleteDoc(doc(getDb(), "reports", r.id))), () => setItems((p) => p.filter((x) => x.id !== r.id)))}>
                  حذف البلاغ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
