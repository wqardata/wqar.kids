"use client";
import { useEffect, useRef, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { compareInSeries, toVideo, type VideoDoc } from "@/lib/videos";

const BATCH = 400;

/** الترتيب «التلقائي»: بالموسم ثم رقم الحلقة ثم الأقدم (يتجاهل الترتيب اليدوي). */
function autoSort(list: VideoDoc[]): VideoDoc[] {
  return [...list].sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

/**
 * ترتيب حلقات مجموعة: أزرار ▲▼ أو سحب وإفلات، ثم «حفظ الترتيب» الذي يكتب `seriesOrder` (1…n) لكل حلقة.
 * الترتيب يظهر للزوار في صفحة المجموعة؛ أرقام الموسم والحلقة تبقى كما هي.
 */
export default function SeriesOrder({ seriesId, onClose }: { seriesId: string; onClose: () => void }) {
  const [list, setList] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [dragId, setDragId] = useState("");
  const [overId, setOverId] = useState("");
  const rows = useRef<Map<string, HTMLLIElement>>(new Map());
  const focusAfter = useRef<{ id: string; dir: "up" | "down" } | null>(null);

  useEffect(() => {
    let off = false;
    setLoading(true);
    getDocs(query(collection(getDb(), "videos"), where("seriesId", "==", seriesId)))
      .then((snap) => {
        if (off) return;
        setList(snap.docs.map((d) => toVideo(d.id, d.data())).sort(compareInSeries));
        setError("");
      })
      .catch(() => !off && setError("تعذّر تحميل حلقات المجموعة."))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [seriesId]);

  // بعد تحريك عنصر بالأزرار نعيد التركيز على زر الاتجاه نفسه كي يستمر التحريك بلوحة المفاتيح.
  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    rows.current.get(f.id)?.querySelector<HTMLButtonElement>(`button[data-dir="${f.dir}"]:not(:disabled)`)?.focus();
  }, [list]);

  const apply = (next: VideoDoc[]) => {
    setList(next);
    setDirty(true);
    setMsg("");
  };

  function move(from: number, to: number) {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    focusAfter.current = { id: it.id, dir: to < from ? "up" : "down" };
    apply(next);
  }

  function drop(targetId: string) {
    const from = list.findIndex((v) => v.id === dragId);
    const to = list.findIndex((v) => v.id === targetId);
    setDragId("");
    setOverId("");
    if (from < 0 || to < 0 || from === to) return;
    const next = [...list];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    apply(next);
  }

  async function save() {
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const db = getDb();
      for (let i = 0; i < list.length; i += BATCH) {
        const batch = writeBatch(db);
        list.slice(i, i + BATCH).forEach((v, k) => batch.update(doc(db, "videos", v.id), { seriesOrder: i + k + 1, updatedAt: serverTimestamp() }));
        await batch.commit();
      }
      setList((prev) => prev.map((v, i) => ({ ...v, seriesOrder: i + 1 })));
      setDirty(false);
      setMsg("تم حفظ الترتيب ✓ (يظهر للزوار في صفحة المجموعة)");
    } catch {
      setError("تعذّر حفظ الترتيب. تأكد من صلاحياتك وقواعد Firestore ثم أعد المحاولة.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="sorder panel" aria-label="ترتيب حلقات المجموعة">
      <h3>ترتيب الحلقات والتخطي</h3>
      <p className="hint">اسحب الحلقة إلى مكانها أو استعمل الأسهم، ثم اضغط «حفظ الترتيب». الحلقات المخفية تظهر هنا بعلامة وتحتفظ بمكانها.</p>
      <div aria-live="polite">
        {error && <p className="field-error" role="alert">{error}</p>}
        {msg && <p className="hint" role="status">{msg}</p>}
      </div>
      {loading ? (
        <p className="empty-note" role="status">جارٍ التحميل…</p>
      ) : list.length === 0 ? (
        <p className="empty-note">لا توجد حلقات في هذه المجموعة.</p>
      ) : (
        <ol className="sorder-list">
          {list.map((v, i) => (
            <li
              key={v.id}
              ref={(el) => {
                if (el) rows.current.set(v.id, el);
                else rows.current.delete(v.id);
              }}
              className={`sorder-row${dragId === v.id ? " is-drag" : ""}${overId === v.id && dragId !== v.id ? " is-over" : ""}`}
              draggable={!saving}
              onDragStart={(e) => {
                setDragId(v.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", v.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                if (overId !== v.id) setOverId(v.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(v.id);
              }}
              onDragEnd={() => {
                setDragId("");
                setOverId("");
              }}
            >
              <span className="sorder-n" aria-hidden="true">{i + 1}</span>
              {v.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnail} alt="" className="nrow-thumb" referrerPolicy="no-referrer" loading="lazy" draggable={false} />
              ) : (
                <span className="nrow-thumb" aria-hidden="true" />
              )}
              <span className="sorder-title">
                <strong>{v.title}</strong>
                <small>
                  {[v.season ? `موسم ${v.season}` : "", v.episode ? `حلقة ${v.episode}` : "", v.hidden ? "مخفي" : ""].filter(Boolean).join(" • ")}
                </small>
              </span>
              <span className="sorder-btns">
                <button type="button" className="btn btn--ghost btn--sm" data-dir="up" aria-label={`رفع «${v.title}» إلى الأعلى`} disabled={i === 0 || saving} onClick={() => move(i, i - 1)}>▲</button>
                <button type="button" className="btn btn--ghost btn--sm" data-dir="down" aria-label={`إنزال «${v.title}» إلى الأسفل`} disabled={i === list.length - 1 || saving} onClick={() => move(i, i + 1)}>▼</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="addrow">
        <button type="button" className="btn btn--sm" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "جارٍ الحفظ…" : "حفظ الترتيب"}</button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={saving || list.length < 2} onClick={() => apply(autoSort(list))}>ترتيب حسب الموسم والحلقة</button>
        <button type="button" className="btn btn--ghost btn--sm" disabled={saving} onClick={() => (dirty && !window.confirm("لديك ترتيب غير محفوظ. إغلاقه يتجاهله. متابعة؟") ? undefined : onClose())}>إغلاق</button>
      </div>
    </section>
  );
}
