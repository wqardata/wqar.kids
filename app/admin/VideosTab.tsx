"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import { getDb } from "@/lib/firebase";
import { toVideo, useNamedList, type VideoDoc } from "@/lib/videos";
import ShortForm from "./ShortForm";

type NamedList = ReturnType<typeof useNamedList>;

function norm(s: string) {
  return s.toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
}

function EditForm({ video, categories, series, onSaved, onCancel }: {
  video: VideoDoc;
  categories: NamedList;
  series: NamedList;
  onSaved: (v: VideoDoc) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [categoryId, setCategoryId] = useState(video.categoryId);
  const [seriesId, setSeriesId] = useState(video.seriesId);
  const [season, setSeason] = useState(video.season?.toString() ?? "");
  const [episode, setEpisode] = useState(video.episode?.toString() ?? "");
  const [isShort, setIsShort] = useState(video.isShort);
  const [hidden, setHidden] = useState(video.hidden);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("العنوان مطلوب.");
    setSaving(true);
    setError("");
    try {
      const cat = categories.items.find((c) => c.id === categoryId);
      const ser = series.items.find((s) => s.id === seriesId);
      const num = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Math.max(1, Math.floor(Number(v))) : null);
      const patch = {
        title: title.trim(),
        description: description.trim(),
        categoryId: cat?.id ?? "",
        categoryName: cat?.name ?? "",
        seriesId: ser?.id ?? "",
        seriesName: ser?.name ?? "",
        season: ser ? num(season) : null,
        episode: ser ? num(episode) : null,
        isShort,
        hidden,
      };
      await updateDoc(doc(getDb(), "videos", video.id), { ...patch, updatedAt: serverTimestamp() });
      onSaved({ ...video, ...patch });
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore.");
      setSaving(false);
    }
  }

  return (
    <form className="auth-form arow-form" onSubmit={(e) => void submit(e)}>
      <div className="field">
        <label htmlFor={`t-${video.id}`}>العنوان</label>
        <input id={`t-${video.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
      </div>
      <div className="field">
        <label htmlFor={`d-${video.id}`}>الوصف</label>
        <textarea id={`d-${video.id}`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </div>
      <CreatableSelect label="التصنيف" items={categories.items} value={categoryId} onChange={setCategoryId} onCreate={categories.create}
        placeholder="بدون تصنيف" newLabel="إضافة تصنيف جديد…" newPlaceholder="اسم التصنيف الجديد" disabled={categories.loading} />
      <CreatableSelect label="السلسلة" items={series.items} value={seriesId} onChange={setSeriesId} onCreate={series.create}
        placeholder="بدون سلسلة" newLabel="إضافة سلسلة جديدة…" newPlaceholder="اسم السلسلة الجديدة" disabled={series.loading} />
      {seriesId && (
        <div className="two">
          <div className="field">
            <label htmlFor={`s-${video.id}`}>الموسم</label>
            <input id={`s-${video.id}`} type="number" min={1} inputMode="numeric" value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`e-${video.id}`}>رقم الحلقة</label>
            <input id={`e-${video.id}`} type="number" min={1} inputMode="numeric" value={episode} onChange={(e) => setEpisode(e.target.value)} />
          </div>
        </div>
      )}
      <label className="check"><input type="checkbox" checked={isShort} onChange={(e) => setIsShort(e.target.checked)} /> مقطع قصير (يظهر في قسم «قصيرة»)</label>
      <label className="check"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> مخفي عن الزوار</label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="addrow">
        <button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ التعديلات"}</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>إلغاء</button>
      </div>
    </form>
  );
}

export default function VideosTab({ shortsOnly = false }: { shortsOnly?: boolean }) {
  const categories = useNamedList("categories");
  const series = useNamedList("series");
  const [items, setItems] = useState<VideoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState("");
  const [busy, setBusy] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    setLoading(true);
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(200)))
      .then((snap) => {
        if (!off) {
          setItems(snap.docs.map((d) => toVideo(d.id, d.data())));
          setError("");
        }
      })
      .catch(() => !off && setError("تعذّر تحميل الفيديوهات."))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [tick]);

  const shown = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    return items
      .filter((v) => (shortsOnly ? v.isShort : true))
      .filter((v) => {
        const hay = norm(`${v.title} ${v.seriesName} ${v.categoryName}`);
        return terms.every((t) => hay.includes(t));
      });
  }, [items, q, shortsOnly]);

  function replace(v: VideoDoc) {
    setItems((prev) => prev.map((x) => (x.id === v.id ? v : x)));
  }

  async function patch(v: VideoDoc, data: Partial<Pick<VideoDoc, "hidden" | "isShort">>) {
    setBusy(v.id);
    setError("");
    try {
      await updateDoc(doc(getDb(), "videos", v.id), { ...data, updatedAt: serverTimestamp() });
      replace({ ...v, ...data });
    } catch {
      setError("تعذّر تنفيذ العملية. تأكد من الصلاحيات.");
    } finally {
      setBusy("");
    }
  }

  async function remove(v: VideoDoc) {
    if (!window.confirm(`حذف «${v.title}» نهائيًا؟ لا يمكن التراجع. (ملف درايف نفسه لن يُحذف)`)) return;
    setBusy(v.id);
    setError("");
    try {
      await deleteDoc(doc(getDb(), "videos", v.id));
      setItems((prev) => prev.filter((x) => x.id !== v.id));
    } catch {
      setError("تعذّر الحذف. تأكد من الصلاحيات.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      {shortsOnly && <ShortForm onCreated={() => setTick((t) => t + 1)} />}

      <div className="field admin-search">
        <label htmlFor="admin-q" className="sr-only">بحث</label>
        <input id="admin-q" type="search" placeholder={shortsOnly ? "ابحث في المقاطع القصيرة" : "ابحث في الفيديوهات"} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}
      {loading ? (
        <p className="empty-note" role="status">جارٍ التحميل…</p>
      ) : shown.length === 0 ? (
        <p className="empty-note">{shortsOnly ? "لا توجد مقاطع قصيرة بعد." : "لا توجد فيديوهات."}</p>
      ) : (
        <ul className="alist">
          {shown.map((v) => (
            <li key={v.id} className="arow">
              {editing === v.id ? (
                <EditForm video={v} categories={categories} series={series} onCancel={() => setEditing("")} onSaved={(nv) => { replace(nv); setEditing(""); }} />
              ) : (
                <>
                  <div className="arow-thumb">
                    {v.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                  </div>
                  <div className="arow-info">
                    <Link href={`/v/${v.id}`}><strong>{v.title}</strong></Link>
                    <small>{[v.categoryName, v.seriesName].filter(Boolean).join(" • ") || "بدون تصنيف"}</small>
                    <span className="badges">
                      {v.isShort && <b className="badge">قصير</b>}
                      {v.hidden && <b className="badge badge--off">مخفي</b>}
                    </span>
                  </div>
                  <div className="arow-actions">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(v.id)} disabled={busy === v.id}>تعديل</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void patch(v, { hidden: !v.hidden })} disabled={busy === v.id}>{v.hidden ? "إظهار" : "إخفاء"}</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => void patch(v, { isShort: !v.isShort })} disabled={busy === v.id}>{v.isShort ? "إلغاء «قصير»" : "اجعله قصيرًا"}</button>
                    <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => void remove(v)} disabled={busy === v.id}>حذف</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
