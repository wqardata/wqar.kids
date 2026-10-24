"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { normalizeAr, pickCover, toVideo, type VideoDoc } from "@/lib/videos";

type Coll = "categories" | "series";
type Item = { id: string; name: string; count: number; coverVideoId: string; vids: VideoDoc[] };

const COUNT_LIMIT = 1000;
const BATCH = 400; // الحد الأقصى في Firestore 500 عملية لكل دفعة.

const TEXT = {
  categories: {
    title: "التصنيفات",
    one: "تصنيف",
    placeholder: "اسم التصنيف الجديد",
    empty: "لا توجد تصنيفات بعد. أضف أول تصنيف من الأعلى.",
    idField: "categoryId",
    nameField: "categoryName",
    // ما يُمسح من الفيديو عند حذف العنصر.
    detach: { categoryId: "", categoryName: "" } as Record<string, unknown>,
    detachNote: "ستصبح فيديوهاته «بدون تصنيف».",
  },
  series: {
    title: "السلاسل",
    one: "سلسلة",
    placeholder: "اسم السلسلة الجديدة",
    empty: "لا توجد سلاسل بعد. أضف أول سلسلة من الأعلى.",
    idField: "seriesId",
    nameField: "seriesName",
    detach: { seriesId: "", seriesName: "", season: null, episode: null } as Record<string, unknown>,
    detachNote: "ستصبح حلقاتها فيديوهات «بدون سلسلة» (ويُمسح رقم الموسم والحلقة).",
  },
} as const;

function clean(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

/** يطبّق تعديلًا على كل فيديو يطابق الشرط، على دفعات. يعيد عدد الفيديوهات المعدَّلة. */
async function patchVideos(idField: string, id: string, data: Record<string, unknown>): Promise<number> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, "videos"), where(idField, "==", id)));
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH)) batch.update(d.ref, { ...data, updatedAt: serverTimestamp() });
    await batch.commit();
  }
  return snap.size;
}

export default function NamedManager({ coll }: { coll: Coll }) {
  const t = TEXT[coll];
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [capped, setCapped] = useState(false);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState("");
  const [editName, setEditName] = useState("");
  const [editCover, setEditCover] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const db = getDb();
      const [list, vids] = await Promise.all([
        getDocs(collection(db, coll)),
        getDocs(query(collection(db, "videos"), limit(COUNT_LIMIT))),
      ]);
      const counts = new Map<string, number>();
      const byId = new Map<string, VideoDoc[]>();
      for (const v of vids.docs) {
        const id = v.data()[t.idField];
        if (typeof id === "string" && id) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
          if (coll === "series") byId.set(id, [...(byId.get(id) ?? []), toVideo(v.id, v.data())]);
        }
      }
      setCapped(vids.size >= COUNT_LIMIT);
      setItems(
        list.docs
          .map((d) => ({
            id: d.id,
            name: String(d.data().name ?? ""),
            count: counts.get(d.id) ?? 0,
            coverVideoId: typeof d.data().coverVideoId === "string" ? (d.data().coverVideoId as string) : "",
            vids: byId.get(d.id) ?? [],
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "ar")),
      );
    } catch {
      setError("تعذّر تحميل القائمة. تأكد من الاتصال وقواعد Firestore.");
    } finally {
      setLoading(false);
    }
  }, [coll, t.idField]);

  useEffect(() => {
    void load();
  }, [load]);

  const taken = useMemo(() => new Map(items.map((i) => [normalizeAr(i.name), i.id])), [items]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const name = clean(newName);
    setMsg("");
    setError("");
    if (!name) return setError(`اكتب اسم ${t.one === "تصنيف" ? "التصنيف" : "السلسلة"} أولًا.`);
    if (taken.has(normalizeAr(name))) return setError("يوجد عنصر بهذا الاسم مسبقًا.");
    setAdding(true);
    try {
      const ref = await addDoc(collection(getDb(), coll), { name, createdAt: serverTimestamp() });
      setItems((prev) => [...prev, { id: ref.id, name, count: 0, coverVideoId: "", vids: [] }].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setNewName("");
      setMsg(`تمت إضافة «${name}» ✓`);
    } catch {
      setError("تعذّرت الإضافة. تأكد من صلاحياتك وقواعد Firestore.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(i: Item) {
    setEditing(i.id);
    setEditName(i.name);
    setEditCover(i.coverVideoId);
    setError("");
    setMsg("");
  }

  async function onRename(e: FormEvent, i: Item) {
    e.preventDefault();
    const name = clean(editName);
    setError("");
    setMsg("");
    if (!name) return setError("الاسم مطلوب.");
    const other = taken.get(normalizeAr(name));
    if (other && other !== i.id) return setError("يوجد عنصر آخر بهذا الاسم.");
    setBusy(i.id);
    try {
      // نحفظ الاسم الجديد أولًا ثم نزامنه في الفيديوهات (لأنها تحمل نسخة من الاسم).
      const patch: Record<string, unknown> = {};
      if (name !== i.name) patch.name = name;
      if (coll === "series" && editCover !== i.coverVideoId) patch.coverVideoId = editCover;
      if (Object.keys(patch).length) await updateDoc(doc(getDb(), coll, i.id), { ...patch, updatedAt: serverTimestamp() });
      setItems((prev) =>
        prev
          .map((x) => (x.id === i.id ? { ...x, name, coverVideoId: coll === "series" ? editCover : x.coverVideoId } : x))
          .sort((a, b) => a.name.localeCompare(b.name, "ar")),
      );
      try {
        const n = name !== i.name ? await patchVideos(t.idField, i.id, { [t.nameField]: name }) : 0;
        setEditing("");
        setMsg(n ? `تم الحفظ وتحديث ${n} فيديو ✓` : "تم الحفظ ✓");
      } catch {
        setError("تغيّر الاسم لكن تعذّر تحديثه في بعض الفيديوهات. اضغط «تعديل» ثم «حفظ» مرة أخرى لإعادة المزامنة.");
      }
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore.");
    } finally {
      setBusy("");
    }
  }

  async function onDelete(i: Item) {
    const warn = i.count > 0 ? `\n\nيستخدمه ${i.count} فيديو. ${t.detachNote}` : "";
    if (!window.confirm(`حذف «${i.name}» نهائيًا؟${warn}\n\n(الفيديوهات نفسها لن تُحذف)`)) return;
    setBusy(i.id);
    setError("");
    setMsg("");
    try {
      // نفصل الفيديوهات أولًا؛ إن فشل ذلك لا نحذف العنصر كي لا تبقى فيديوهات تشير إلى عنصر ضائع.
      await patchVideos(t.idField, i.id, t.detach);
      await deleteDoc(doc(getDb(), coll, i.id));
      setItems((prev) => prev.filter((x) => x.id !== i.id));
      setMsg(`تم حذف «${i.name}» ✓`);
    } catch {
      setError("تعذّر الحذف. لم يُحذف شيء؛ تأكد من صلاحياتك وحاول مرة أخرى.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <form className="auth-form panel" onSubmit={(e) => void onAdd(e)}>
        <h2>إضافة {t.one}</h2>
        <div className="addrow">
          <label htmlFor={`nm-${coll}`} className="sr-only">{t.placeholder}</label>
          <input id={`nm-${coll}`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.placeholder} maxLength={80} autoComplete="off" />
          <button type="submit" className="btn btn--sm" disabled={adding || !newName.trim()}>{adding ? "..." : "إضافة"}</button>
        </div>
      </form>

      <div aria-live="polite">
        {error && <p className="field-error" role="alert">{error}</p>}
        {msg && <p className="hint" role="status">{msg}</p>}
      </div>

      {loading ? (
        <p className="empty-note" role="status">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <p className="empty-note">{t.empty}</p>
      ) : (
        <>
          <ul className="alist nlist" aria-label={t.title}>
            {items.map((i) => (
              <li key={i.id} className="nrow">
                {editing === i.id ? (
                  <form className="addrow nrow-edit" onSubmit={(e) => void onRename(e, i)}>
                    <label htmlFor={`ed-${i.id}`} className="sr-only">الاسم الجديد</label>
                    <input id={`ed-${i.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} autoFocus onKeyDown={(e) => e.key === "Escape" && setEditing("")} />
                    {coll === "series" && (
                      <div className="field nrow-cover">
                        <label htmlFor={`cv-${i.id}`}>صورة المجموعة (من أي فيديو فيها)</label>
                        <select id={`cv-${i.id}`} value={editCover} onChange={(e) => setEditCover(e.target.value)}>
                          <option value="">تلقائي — الأكثر مشاهدة</option>
                          {i.vids.filter((v) => !v.hidden).map((v) => (
                            <option key={v.id} value={v.id}>{v.title}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button type="submit" className="btn btn--sm" disabled={busy === i.id}>{busy === i.id ? "..." : "حفظ"}</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing("")}>إلغاء</button>
                  </form>
                ) : (
                  <>
                    <div className="nrow-lead">
                      {coll === "series" && (() => {
                        const c = pickCover(i.vids, i.coverVideoId);
                        // eslint-disable-next-line @next/next/no-img-element
                        return c?.thumbnail ? <img src={c.thumbnail} alt="" className="nrow-thumb" referrerPolicy="no-referrer" loading="lazy" /> : <span className="nrow-thumb" aria-hidden="true" />;
                      })()}
                      <div className="nrow-info">
                        <strong>{i.name}</strong>
                        <small>
                          {i.count}{capped && i.count > 0 ? "+" : ""} {coll === "series" ? "حلقة" : "فيديو"}
                        </small>
                      </div>
                    </div>
                    <div className="nrow-actions">
                      {coll === "series" && <Link href={`/series/${i.id}`} className="btn btn--ghost btn--sm">عرض</Link>}
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => startEdit(i)} disabled={busy === i.id}>تعديل</button>
                      <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => void onDelete(i)} disabled={busy === i.id}>حذف</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          {capped && <p className="hint">العدّاد يحسب أحدث {COUNT_LIMIT} فيديو فقط.</p>}
        </>
      )}
    </div>
  );
}
