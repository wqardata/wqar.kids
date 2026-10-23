"use client";

import { useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import Icon from "@/components/Icon";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { createLocalSet } from "@/lib/localSet";

export const REPORT_REASONS = ["محتوى غير مناسب", "الفيديو لا يعمل", "معلومات خاطئة أو عنوان مضلل", "حقوق نشر", "سبب آخر"] as const;

const sent = createLocalSet("reported");

/** زر «إبلاغ» (أيقونة + كلمة) يفتح نموذجًا صغيرًا أسفل صف الأزرار. */
export default function ReportButton({ videoId, videoTitle }: { videoId: string; videoTitle: string }) {
  const already = sent.useIds().includes(videoId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isFirebaseConfigured) return setError("الإبلاغ غير متاح حاليًا.");
    setBusy(true);
    setError("");
    try {
      await addDoc(collection(getDb(), "reports"), {
        videoId,
        videoTitle: videoTitle.slice(0, 200),
        reason,
        note: note.trim().slice(0, 500),
        status: "open",
        createdAt: serverTimestamp(),
      });
      sent.toggle(videoId);
      setOpen(false);
      setNote("");
    } catch {
      setError("تعذّر إرسال البلاغ. حاول لاحقًا.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`ibtn ibtn--text${already ? " on" : ""}`}
        aria-expanded={open}
        aria-controls="report-form"
        disabled={already}
        title={already ? "تم إرسال بلاغك. شكرًا لك" : "إبلاغ عن مشكلة في هذا الفيديو"}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="flag" size={20} />
        <span>{already ? "تم الإبلاغ" : "إبلاغ"}</span>
      </button>
      {open && (
        <form id="report-form" className="report-form" onSubmit={(e) => void submit(e)}>
          <div className="field">
            <label htmlFor="rp-reason">سبب البلاغ</label>
            <select id="rp-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rp-note">تفاصيل (اختياري)</label>
            <textarea id="rp-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="addrow">
            <button type="submit" className="btn btn--sm" disabled={busy}>{busy ? "جارٍ الإرسال…" : "إرسال البلاغ"}</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>إلغاء</button>
          </div>
        </form>
      )}
    </>
  );
}
