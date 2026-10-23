"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { getDb } from "@/lib/firebase";

type Report = { id: string; videoId: string; videoTitle: string; reason: string; note: string; status: "open" | "done"; at: number | null };

export default function ReportsTab() {
  const { user } = useAuth();
  // true = البلاغات تُدار عبر الخادم (FIREBASE_SERVICE_ACCOUNT)؛ false = مباشرة من Firestore (تتطلب القواعد).
  const [viaApi, setViaApi] = useState(false);
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [showDone, setShowDone] = useState(false);

  async function api(method: "GET" | "PATCH" | "DELETE", id?: string): Promise<Response> {
    const token = await user?.getIdToken();
    return fetch(method === "DELETE" ? `/api/reports?id=${encodeURIComponent(id ?? "")}` : "/api/reports", {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(method === "PATCH" ? { "content-type": "application/json" } : {}) },
      body: method === "PATCH" ? JSON.stringify({ id }) : undefined,
      cache: "no-store",
    });
  }

  useEffect(() => {
    if (!user) return;
    let off = false;
    // أولًا عبر الخادم؛ إن لم يُضبط (501) أو تعذّر نقرأ من Firestore مباشرة.
    api("GET")
      .then(async (r) => {
        if (!r.ok) throw new Error("fallback");
        const j = (await r.json()) as { reports: Report[] };
        if (off) return;
        setViaApi(true);
        setItems(j.reports);
        setLoading(false);
      })
      .catch(() => {
        if (!off) loadFromDb();
      });
    function loadFromDb() {
    getDocs(query(collection(getDb(), "reports"), orderBy("createdAt", "desc"), limit(100)))
      .then((snap) => {
        if (off) return;
        setItems(
          snap.docs.map((d) => {
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
            } as Report;
          }),
        );
      })
      .catch(() => !off && setError("تعذّر تحميل البلاغات. تأكد من قواعد Firestore (reports)."))
      .finally(() => !off && setLoading(false));
    }
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  const shown = items.filter((r) => showDone || r.status === "open");
  const open = items.filter((r) => r.status === "open").length;

  return (
    <div className="panel">
      <h2>البلاغات{open > 0 && ` (${open} جديد)`}</h2>
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
                    onClick={() => void run(r.id, () => (viaApi ? api("PATCH", r.id).then((x) => { if (!x.ok) throw new Error("api"); }) : updateDoc(doc(getDb(), "reports", r.id), { status: "done", updatedAt: serverTimestamp() })), () => setItems((p) => p.map((x) => (x.id === r.id ? { ...x, status: "done" } : x))))}>
                    تمت المعالجة
                  </button>
                )}
                <button type="button" className="btn btn--ghost btn--sm" disabled={busy === r.id}
                  onClick={() => void run(r.id, () => updateDoc(doc(getDb(), "videos", r.videoId), { hidden: true, updatedAt: serverTimestamp() }), () => {})}
                  title="يخفي الفيديو عن الزوار">
                  إخفاء الفيديو
                </button>
                <button type="button" className="btn btn--ghost btn--sm danger" disabled={busy === r.id}
                  onClick={() => void run(r.id, () => (viaApi ? api("DELETE", r.id).then((x) => { if (!x.ok) throw new Error("api"); }) : deleteDoc(doc(getDb(), "reports", r.id))), () => setItems((p) => p.filter((x) => x.id !== r.id)))}>
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
