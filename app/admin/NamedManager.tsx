"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import type { NamedPatch } from "@/lib/adminInput";
import { USE_NEON } from "@/lib/backend";
import { getDb } from "@/lib/firebase";
import { adminCreateNamed, adminDeleteNamed, adminNamedList, adminUpdateNamed, adminVideoList } from "@/lib/neonAdminClient";
import { cleanAvatarUrl, cleanCoverImage, clearVideoCache, normalizeAr, pickCover, toVideo, type VideoDoc } from "@/lib/videos";
import { driveThumbnail, parseDriveId } from "@/lib/drive";
import { deleteThumb, fileToJpegDataUrl, saveThumb } from "@/lib/thumbs";
import SeriesOrder from "./SeriesOrder";
import { useSaveApi, useSaveRegistration } from "./saveKit";

type Coll = "categories" | "series";
type Item = { id: string; name: string; count: number; coverVideoId: string; coverImage: string; vids: VideoDoc[] };
/** مصدر صورة المجموعة: فيديو منها، أو صورة مرفوعة من الجهاز، أو رابط صورة من درايف. */
type CoverMode = "video" | "upload" | "drive";
const isUploaded = (url: string) => url.startsWith("/api/thumb/");

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
    title: "المجموعات",
    one: "مجموعة",
    placeholder: "اسم المجموعة الجديدة",
    empty: "لا توجد مجموعات بعد. أضف أول مجموعة من الأعلى.",
    idField: "seriesId",
    nameField: "seriesName",
    detach: { seriesId: "", seriesName: "", season: null, episode: null, seriesOrder: null } as Record<string, unknown>,
    detachNote: "ستصبح حلقاتها فيديوهات «بدون مجموعة» (ويُمسح رقم الموسم والحلقة).",
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
  const [coverMode, setCoverMode] = useState<CoverMode>("video");
  const [coverFile, setCoverFile] = useState(""); // معاينة الصورة المختارة من الجهاز (data URL) قبل الحفظ
  const [coverLink, setCoverLink] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [busy, setBusy] = useState("");
  const [ordering, setOrdering] = useState(""); // المجموعة المفتوح ترتيب حلقاتها

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (USE_NEON) {
        const [list, vids] = await Promise.all([adminNamedList(coll), adminVideoList()]);
        const counts = new Map<string, number>();
        const byId = new Map<string, VideoDoc[]>();
        for (const v of vids) {
          const id = coll === "series" ? v.seriesId : v.categoryId;
          if (!id) continue;
          counts.set(id, (counts.get(id) ?? 0) + 1);
          if (coll === "series") byId.set(id, [...(byId.get(id) ?? []), v]);
        }
        const trunc = vids.length >= COUNT_LIMIT;
        setCapped(trunc);
        if (coll === "series") {
          // مزامنة رابط صورة كل مجموعة (avatarUrl) كما في مسار Firestore.
          for (const n of list) {
            const mine = byId.get(n.id) ?? [];
            const url = n.coverImage || pickCover(mine, n.coverVideoId)?.thumbnail || pickCover(mine, "")?.thumbnail || "";
            if (cleanAvatarUrl(n.avatarUrl) !== cleanAvatarUrl(url) && (url || !trunc)) {
              adminUpdateNamed("series", n.id, { avatarUrl: cleanAvatarUrl(url) }).then(() => clearVideoCache()).catch(() => {});
            }
          }
        }
        setItems(
          list
            .map((n) => ({ id: n.id, name: n.name, count: counts.get(n.id) ?? 0, coverVideoId: n.coverVideoId ?? "", coverImage: n.coverImage ?? "", vids: byId.get(n.id) ?? [] }))
            .sort((a, b) => a.name.localeCompare(b.name, "ar")),
        );
        return;
      }
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
      // مزامنة رابط صورة كل مجموعة (avatarUrl) في مستندها، كي يقرأ الزوار المستند وحده دون جلب كل الفيديوهات.
      if (coll === "series") {
        for (const d of list.docs) {
          const mine = byId.get(d.id) ?? [];
          const cover = typeof d.data().coverVideoId === "string" ? (d.data().coverVideoId as string) : "";
          const url = cleanCoverImage(d.data().coverImage) || pickCover(mine, cover)?.thumbnail || pickCover(mine, "")?.thumbnail || "";
          const cur = typeof d.data().avatarUrl === "string" ? cleanAvatarUrl(d.data().avatarUrl) : null;
          // لا نكتب فراغًا إن كانت قراءة الفيديوهات مبتورة (حد العدّ)، ولا نكتب إلا عند وجود فرق.
          if (cur !== url && (url || !(vids.size >= COUNT_LIMIT))) {
            updateDoc(d.ref, { avatarUrl: cleanAvatarUrl(url) }).then(() => clearVideoCache()).catch(() => {});
          }
        }
      }
      setItems(
        list.docs
          .map((d) => ({
            id: d.id,
            name: String(d.data().name ?? ""),
            count: counts.get(d.id) ?? 0,
            coverVideoId: typeof d.data().coverVideoId === "string" ? (d.data().coverVideoId as string) : "",
            coverImage: cleanCoverImage(d.data().coverImage),
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
    if (!name) return setError(`اكتب اسم ${t.one === "تصنيف" ? "التصنيف" : "المجموعة"} أولًا.`);
    if (taken.has(normalizeAr(name))) return setError("يوجد عنصر بهذا الاسم مسبقًا.");
    setAdding(true);
    try {
      const newId = USE_NEON ? await adminCreateNamed(coll, name) : (await addDoc(collection(getDb(), coll), { name, createdAt: serverTimestamp() })).id;
      setItems((prev) => [...prev, { id: newId, name, count: 0, coverVideoId: "", coverImage: "", vids: [] }].sort((a, b) => a.name.localeCompare(b.name, "ar")));
      setNewName("");
      setMsg(`تمت إضافة «${name}» ✓`);
    } catch {
      setError("تعذّرت الإضافة. تأكد من صلاحياتك وقواعد Firestore.");
    } finally {
      setAdding(false);
    }
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setCoverBusy(true);
    try {
      setCoverFile(await fileToJpegDataUrl(file));
    } catch (e) {
      setCoverFile("");
      setError(e instanceof Error ? e.message : "تعذّر قراءة الصورة.");
    } finally {
      setCoverBusy(false);
    }
  }

  function startEdit(i: Item) {
    setEditing(i.id);
    setEditName(i.name);
    setEditCover(i.coverVideoId);
    setCoverMode(i.coverImage ? (isUploaded(i.coverImage) ? "upload" : "drive") : "video");
    setCoverFile("");
    setCoverLink(i.coverImage && !isUploaded(i.coverImage) ? i.coverImage : "");
    setError("");
    setMsg("");
  }

  /** يحفظ تعديل العنصر المفتوح (الاسم والصورة)؛ يعيد true عند النجاح. */
  async function saveEdit(): Promise<boolean> {
    const i = items.find((x) => x.id === editing);
    if (!i) return false;
    const name = clean(editName);
    setError("");
    setMsg("");
    if (!name) return setError("الاسم مطلوب."), false;
    const other = taken.get(normalizeAr(name));
    if (other && other !== i.id) return setError("يوجد عنصر آخر بهذا الاسم."), false;
    setBusy(i.id);
    try {
      // نحفظ الاسم الجديد أولًا ثم نزامنه في الفيديوهات (لأنها تحمل نسخة من الاسم).
      const patch: Record<string, unknown> = {};
      if (name !== i.name) patch.name = name;
      let nextImage = i.coverImage;
      let nextVideo = i.coverVideoId;
      if (coll === "series") {
        if (coverMode === "video") {
          nextImage = "";
          nextVideo = editCover;
        } else if (coverMode === "upload") {
          if (coverFile) nextImage = await saveThumb(i.id, coverFile);
          else if (!isUploaded(i.coverImage)) {
            setError("اختر صورة من جهازك أولًا، أو غيّر مصدر الصورة.");
            return false;
          }
        } else {
          const id = parseDriveId(coverLink);
          if (!id) {
            setError("الصق رابط صورة درايف صحيحًا (مشاركة: «أي شخص لديه الرابط»).");
            return false;
          }
          nextImage = driveThumbnail(id, 640);
        }
        if (nextImage !== i.coverImage) patch.coverImage = nextImage;
        // الرابط الجاهز لصورة المجموعة (يقرؤه الزوار بدل جلب كل الفيديوهات).
        patch.avatarUrl = cleanAvatarUrl(nextImage || pickCover(i.vids, nextVideo)?.thumbnail || pickCover(i.vids, "")?.thumbnail || "");
        if (nextVideo !== i.coverVideoId) patch.coverVideoId = nextVideo;
      }
      let synced = 0; // على Neon يزامن الخادم اسم العنصر في فيديوهاته ضمن الجملة نفسها
      if (Object.keys(patch).length) {
        if (USE_NEON) synced = (await adminUpdateNamed(coll, i.id, patch as NamedPatch)).videos;
        else await updateDoc(doc(getDb(), coll, i.id), { ...patch, updatedAt: serverTimestamp() });
      }
      // الصورة المرفوعة التي لم تعد مستعملة تُحذف كي لا تبقى يتيمة.
      if (coll === "series" && isUploaded(i.coverImage) && !isUploaded(nextImage)) void deleteThumb(i.id);
      clearVideoCache();
      setItems((prev) =>
        prev
          .map((x) => (x.id === i.id ? { ...x, name, coverVideoId: nextVideo, coverImage: nextImage } : x))
          .sort((a, b) => a.name.localeCompare(b.name, "ar")),
      );
      try {
        const n = name !== i.name ? (USE_NEON ? synced : await patchVideos(t.idField, i.id, { [t.nameField]: name })) : 0;
        setEditing("");
        setMsg(n ? `تم الحفظ وتحديث ${n} فيديو ✓` : "تم الحفظ ✓");
        return true;
      } catch {
        setError("تغيّر الاسم لكن تعذّر تحديثه في بعض الفيديوهات. اضغط «تعديل» ثم «حفظ التغييرات» مرة أخرى لإعادة المزامنة.");
        return false;
      }
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore.");
      return false;
    } finally {
      setBusy("");
    }
  }

  // الحفظ من الشريط أعلى الصفحة؛ وEnter في حقل الاسم يعادله. «العودة» تُرجع الحقول إلى المحفوظ.
  const saveApi = useSaveApi();
  const editItem = items.find((x) => x.id === editing);
  const initMode: CoverMode = editItem?.coverImage ? (isUploaded(editItem.coverImage) ? "upload" : "drive") : "video";
  const initLink = editItem?.coverImage && !isUploaded(editItem.coverImage) ? editItem.coverImage : "";
  const editDirty =
    !!editItem &&
    (clean(editName) !== editItem.name ||
      (coll === "series" && (coverMode !== initMode || coverFile !== "" || editCover !== editItem.coverVideoId || coverLink !== initLink)));
  useSaveRegistration({
    dirty: editDirty,
    isDefault: !editDirty,
    error: editing ? error : "",
    busy: busy !== "" || coverBusy,
    save: saveEdit,
    reset: () => editItem && startEdit(editItem),
  });
  function cancelEdit() {
    if (editDirty && !window.confirm("لديك تعديلات غير محفوظة. الإلغاء يتجاهلها. متابعة؟")) return;
    setEditing("");
  }

  async function onDelete(i: Item) {
    const warn = i.count > 0 ? `\n\nيستخدمه ${i.count} فيديو. ${t.detachNote}` : "";
    if (!window.confirm(`حذف «${i.name}» نهائيًا؟${warn}\n\n(الفيديوهات نفسها لن تُحذف)`)) return;
    setBusy(i.id);
    setError("");
    setMsg("");
    try {
      // نفصل الفيديوهات أولًا؛ إن فشل ذلك لا نحذف العنصر كي لا تبقى فيديوهات تشير إلى عنصر ضائع.
      if (USE_NEON) {
        await adminDeleteNamed(coll, i.id); // الفصل والحذف في جملة واحدة ذرّية
      } else {
        await patchVideos(t.idField, i.id, t.detach);
        await deleteDoc(doc(getDb(), coll, i.id));
      }
      if (coll === "series" && isUploaded(i.coverImage)) void deleteThumb(i.id);
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
        {error && !editing && <p className="field-error" role="alert">{error}</p>}
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
                  <form className="addrow nrow-edit" onSubmit={(e) => { e.preventDefault(); if (saveApi) void saveApi.saveAll(); else void saveEdit(); }}>
                    <label htmlFor={`ed-${i.id}`} className="sr-only">الاسم الجديد</label>
                    <input id={`ed-${i.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} autoFocus onKeyDown={(e) => e.key === "Escape" && cancelEdit()} />
                    {coll === "series" && (() => {
                      const driveId = parseDriveId(coverLink);
                      const preview =
                        coverMode === "upload" ? coverFile || (isUploaded(i.coverImage) ? i.coverImage : "")
                        : coverMode === "drive" ? (driveId ? driveThumbnail(driveId, 320) : "")
                        : pickCover(i.vids, editCover)?.thumbnail ?? "";
                      return (
                        <fieldset className="nrow-cover cover-edit">
                          <legend>صورة المجموعة — تظهر على بطاقتها وبجانب اسم كل فيديو منها</legend>
                          <div className="cover-modes" role="radiogroup" aria-label="مصدر الصورة">
                            <label className="check"><input type="radio" name={`cm-${i.id}`} checked={coverMode === "video"} onChange={() => setCoverMode("video")} /> من فيديو في المجموعة</label>
                            <label className="check"><input type="radio" name={`cm-${i.id}`} checked={coverMode === "upload"} onChange={() => setCoverMode("upload")} /> رفع صورة من الجهاز</label>
                            <label className="check"><input type="radio" name={`cm-${i.id}`} checked={coverMode === "drive"} onChange={() => setCoverMode("drive")} /> رابط صورة من درايف</label>
                          </div>
                          {coverMode === "video" && (
                            <div className="field">
                              <label htmlFor={`cv-${i.id}`} className="sr-only">الفيديو الذي تؤخذ صورته</label>
                              <select id={`cv-${i.id}`} value={editCover} onChange={(e) => setEditCover(e.target.value)}>
                                <option value="">تلقائي — صورة أكثر فيديوهاتها مشاهدة</option>
                                {i.vids.filter((v) => !v.hidden).map((v) => (
                                  <option key={v.id} value={v.id}>{v.title}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {coverMode === "upload" && (
                            <div className="field">
                              <label htmlFor={`cf-${i.id}`}>اختر صورة (JPG أو PNG أو WebP) — تُصغَّر تلقائيًا</label>
                              <input id={`cf-${i.id}`} type="file" accept="image/*" onChange={(e) => { void onPickFile(e.target.files?.[0]); e.target.value = ""; }} />
                              {coverBusy && <p className="hint" role="status">جارٍ تجهيز الصورة…</p>}
                            </div>
                          )}
                          {coverMode === "drive" && (
                            <div className="field">
                              <label htmlFor={`cl-${i.id}`}>رابط الصورة في درايف</label>
                              <input id={`cl-${i.id}`} dir="ltr" value={coverLink} onChange={(e) => setCoverLink(e.target.value)} placeholder="https://drive.google.com/file/d/…/view" autoComplete="off" />
                              <p className="hint">يجب أن تكون مشاركة الصورة «أي شخص لديه الرابط»، وإلا لن تظهر للزوار.</p>
                              {coverLink.trim() && !driveId && <p className="field-error">لم أستطع استخراج معرّف الملف من هذا الرابط.</p>}
                            </div>
                          )}
                          {preview && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="معاينة صورة المجموعة" className="cover-preview" referrerPolicy="no-referrer" />
                          )}
                        </fieldset>
                      );
                    })()}
                    {!saveApi && <button type="submit" className="btn btn--sm" disabled={busy === i.id || coverBusy}>{busy === i.id ? "..." : "حفظ"}</button>}
                    <button type="button" className="btn btn--ghost btn--sm" disabled={busy === i.id} onClick={cancelEdit}>إلغاء</button>
                  </form>
                ) : (
                  <>
                    <div className="nrow-lead">
                      {coll === "series" && (() => {
                        const url = i.coverImage || pickCover(i.vids, i.coverVideoId)?.thumbnail;
                        // eslint-disable-next-line @next/next/no-img-element
                        return url ? <img src={url} alt="" className="nrow-thumb" referrerPolicy="no-referrer" loading="lazy" /> : <span className="nrow-thumb" aria-hidden="true" />;
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
                      {coll === "series" && (
                        <button type="button" className="btn btn--ghost btn--sm" aria-expanded={ordering === i.id} onClick={() => setOrdering(ordering === i.id ? "" : i.id)} disabled={busy === i.id || i.count < 2}>
                          ترتيب الحلقات
                        </button>
                      )}
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => startEdit(i)} disabled={busy === i.id}>تعديل</button>
                      <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => void onDelete(i)} disabled={busy === i.id}>حذف</button>
                    </div>
                    {coll === "series" && ordering === i.id && (
                      <div className="nrow-order">
                        <SeriesOrder seriesId={i.id} onClose={() => setOrdering("")} />
                      </div>
                    )}
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
