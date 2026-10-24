"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { driveThumbnail } from "@/lib/drive";
import { getDb } from "@/lib/firebase";
import { formatClock } from "@/lib/format";
import { openGrabber } from "@/lib/frameGrab";
import { deleteThumb, saveThumb } from "@/lib/thumbs";
import { useRandomFrame } from "@/lib/useRandomFrame";
import { toVideo, useNamedList, type VideoDoc } from "@/lib/videos";
import ClipEditor from "./ClipEditor";
import ShortForm from "./ShortForm";

type NamedList = ReturnType<typeof useNamedList>;

const PAGE_SIZE = 50;
const NONE = "__none"; // قيمة «بدون» في مرشحات التصنيف والسلسلة

/** أرقام الصفحات: الأولى والأخيرة وما حول الحالية، وبينها «…». */
function pageList(cur: number, last: number): (number | "gap")[] {
  const keep = new Set([1, last, cur - 1, cur, cur + 1]);
  const nums = [...keep].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

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
  // الصورة المصغّرة: إبقاء الحالية، أو لقطة عشوائية بعد الثانية 10، أو صورة درايف الافتراضية.
  const { user } = useAuth();
  const [thumbMode, setThumbMode] = useState<"keep" | "random" | "drive">("keep");
  const frame = useRandomFrame(video.driveId || null, user, thumbMode === "random");
  const capturing = thumbMode === "random" && frame.status === "loading";
  const newFrame = thumbMode === "random" && frame.status === "ok" && frame.dataUrl ? frame.dataUrl : "";
  const shownThumb = newFrame || (thumbMode === "drive" && video.driveId ? driveThumbnail(video.driveId) : video.thumbnail);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("العنوان مطلوب.");
    setSaving(true);
    setError("");
    try {
      const cat = categories.items.find((c) => c.id === categoryId);
      const ser = series.items.find((s) => s.id === seriesId);
      const num = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Math.max(1, Math.floor(Number(v))) : null);
      let thumbnail = video.thumbnail;
      if (newFrame) {
        try {
          thumbnail = await saveThumb(video.id, newFrame);
        } catch {
          setError("تعذّر حفظ الصورة المختارة. حدّث قواعد Firestore (thumbs) من firestore.rules.");
          setSaving(false);
          return;
        }
      } else if (thumbMode === "drive" && video.driveId) {
        thumbnail = driveThumbnail(video.driveId);
      }
      const patch = {
        thumbnail,
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
      if (thumbMode === "drive") void deleteThumb(video.id); // لم تعد اللقطة المحفوظة مستعملة
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
      <div className="field">
        <span id={`th-${video.id}`}>الصورة المصغّرة</span>
        <div className="arow-thumb thumbedit-img" aria-labelledby={`th-${video.id}`}>
          {shownThumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownThumb} alt="" referrerPolicy="no-referrer" />
          )}
        </div>
        {video.driveId && (
          <div className="addrow">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={capturing}
              onClick={() => (thumbMode === "random" && frame.canReroll ? void frame.reroll() : setThumbMode("random"))}
            >
              🎲 {thumbMode === "random" && frame.status === "ok" ? "لقطة أخرى" : "لقطة عشوائية بعد الثانية 10"}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" disabled={thumbMode === "drive"} onClick={() => setThumbMode("drive")}>
              صورة درايف الافتراضية
            </button>
            {thumbMode !== "keep" && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setThumbMode("keep")}>إبقاء الحالية</button>
            )}
          </div>
        )}
        {capturing && <p className="hint" role="status">جارٍ التقاط صورة من الفيديو…</p>}
        {thumbMode === "random" && frame.status === "ok" && <p className="hint">اللقطة من الثانية {formatClock(frame.time)} — تُحفظ عند الضغط على «حفظ التعديلات».</p>}
        {thumbMode === "random" && frame.message && <p className="hint" role="status">{frame.message}</p>}
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
        <button type="submit" disabled={saving || capturing}>{saving ? "جارٍ الحفظ…" : "حفظ التعديلات"}</button>
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
  // التصفية: التصنيف والسلسلة ("" = الكل، NONE = بدون) والظهور.
  const [fCat, setFCat] = useState("");
  const [fSer, setFSer] = useState("");
  const [fVis, setFVis] = useState<"all" | "visible" | "hidden">("all");
  const [editing, setEditing] = useState("");
  const [clipping, setClipping] = useState("");
  const [busy, setBusy] = useState("");
  const [tick, setTick] = useState(0);
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const [probe, setProbe] = useState("");
  // التعديل الجماعي: الفيديوهات المحدَّدة، وما سيُغيَّر (التصنيف و/أو السلسلة).
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [chgCat, setChgCat] = useState(false);
  const [chgSer, setChgSer] = useState(false);
  const [bulkCat, setBulkCat] = useState("");
  const [bulkSer, setBulkSer] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  useEffect(() => {
    let off = false;
    setLoading(true);
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(1000)))
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
      .filter((v) => (fCat === "" ? true : fCat === NONE ? !v.categoryId : v.categoryId === fCat))
      .filter((v) => (fSer === "" ? true : fSer === NONE ? !v.seriesId : v.seriesId === fSer))
      .filter((v) => (fVis === "all" ? true : fVis === "hidden" ? v.hidden : !v.hidden))
      .filter((v) => {
        const hay = norm(`${v.title} ${v.seriesName} ${v.categoryName}`);
        return terms.every((t) => hay.includes(t));
      });
  }, [items, q, shortsOnly, fCat, fSer, fVis]);

  const lastPage = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const cur = Math.min(page, lastPage);
  const pageItems = useMemo(() => shown.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE), [shown, cur]);
  // البحث يعيدنا للصفحة الأولى.
  useEffect(() => setPage(1), [q, shortsOnly, fCat, fSer, fVis]);
  const goTo = (n: number) => {
    setPage(Math.min(lastPage, Math.max(1, n)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allShownSelected = pageItems.length > 0 && pageItems.every((v) => sel.has(v.id));

  /** يطبّق التصنيف و/أو السلسلة على كل المحدَّدين دفعة واحدة. */
  async function applyBulk() {
    const ids = items.filter((v) => sel.has(v.id)).map((v) => v.id);
    if (ids.length === 0) return setError("حدّد فيديو واحدًا على الأقل.");
    if (!chgCat && !chgSer) return setError("اختر ما تريد تغييره: التصنيف أو السلسلة.");
    if (chgCat && !bulkCat) return setError("اختر التصنيف الجديد.");
    const cat = categories.items.find((c) => c.id === bulkCat);
    const ser = series.items.find((s) => s.id === bulkSer);
    const what = [chgCat && `التصنيف «${cat?.name ?? ""}»`, chgSer && (ser ? `السلسلة «${ser.name}»` : "إزالة السلسلة")].filter(Boolean).join(" و");
    if (!window.confirm(`تطبيق ${what} على ${ids.length} فيديو؟`)) return;
    setBulkBusy(true);
    setError("");
    setBulkMsg("");
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    const local: Partial<VideoDoc> = {};
    if (chgCat) {
      data.categoryId = bulkCat;
      data.categoryName = cat?.name ?? "";
      local.categoryId = bulkCat;
      local.categoryName = cat?.name ?? "";
    }
    if (chgSer) {
      data.seriesId = ser?.id ?? "";
      data.seriesName = ser?.name ?? "";
      local.seriesId = ser?.id ?? "";
      local.seriesName = ser?.name ?? "";
      // إزالة السلسلة تُزيل الموسم والحلقة معها لأنهما يخصّانها.
      if (!ser) {
        data.season = null;
        data.episode = null;
        local.season = null;
        local.episode = null;
      }
    }
    try {
      const db = getDb();
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db);
        ids.slice(i, i + 400).forEach((id) => batch.update(doc(db, "videos", id), data));
        await batch.commit();
      }
      const done = new Set(ids);
      setItems((prev) => prev.map((v) => (done.has(v.id) ? { ...v, ...local } : v)));
      setBulkMsg(`تم تحديث ${ids.length} فيديو ✓`);
      setSel(new Set());
    } catch {
      setError("تعذّر تنفيذ التعديل الجماعي. تأكد من الصلاحيات ثم أعد المحاولة (قد يكون جزء منها قد تغيّر).");
    } finally {
      setBulkBusy(false);
    }
  }

  /** إخفاء/إظهار/حذف كل المحدَّدين دفعة واحدة. */
  async function bulkAction(kind: "hide" | "show" | "delete") {
    const picked = items.filter((v) => sel.has(v.id));
    if (picked.length === 0) return setError("حدّد فيديو واحدًا على الأقل.");
    if (kind === "delete" && !window.confirm(`حذف ${picked.length} فيديو نهائيًا؟ لا يمكن التراجع. (ملفات درايف نفسها لن تُحذف)`)) return;
    setBulkBusy(true);
    setError("");
    setBulkMsg("");
    try {
      const db = getDb();
      for (let i = 0; i < picked.length; i += 400) {
        const batch = writeBatch(db);
        picked.slice(i, i + 400).forEach((v) => {
          const ref = doc(db, "videos", v.id);
          if (kind === "delete") batch.delete(ref);
          else batch.update(ref, { hidden: kind === "hide", updatedAt: serverTimestamp() });
        });
        await batch.commit();
      }
      const done = new Set(picked.map((v) => v.id));
      if (kind === "delete") {
        picked.forEach((v) => void deleteThumb(v.id));
        setItems((prev) => prev.filter((v) => !done.has(v.id)));
      } else {
        setItems((prev) => prev.map((v) => (done.has(v.id) ? { ...v, hidden: kind === "hide" } : v)));
      }
      setBulkMsg(`${kind === "delete" ? "تم حذف" : kind === "hide" ? "تم إخفاء" : "تم إظهار"} ${picked.length} فيديو ✓`);
      setSel(new Set());
    } catch {
      setError("تعذّر تنفيذ العملية الجماعية. تأكد من الصلاحيات ثم أعد المحاولة (قد يكون جزء منها قد نُفّذ).");
    } finally {
      setBulkBusy(false);
    }
  }

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

  /** يقرأ مدد الفيديوهات الناقصة (تظهر على الصور المصغّرة) ويحفظها في مستند كل فيديو. */
  async function fetchDurations() {
    if (!user) return;
    const missing = items.filter((v) => v.driveId && !v.duration);
    if (missing.length === 0) return;
    setError("");
    let failed = 0;
    for (let n = 0; n < missing.length; n++) {
      const v = missing[n];
      setProbe(`جارٍ قراءة المدة ${n + 1} من ${missing.length}…`);
      try {
        const token = await user.getIdToken();
        const g = await openGrabber(`/api/drive-video?id=${encodeURIComponent(v.driveId)}&token=${encodeURIComponent(token)}`);
        const d = Math.round(g.duration);
        g.dispose();
        if (d <= 0) throw new Error("no duration");
        await updateDoc(doc(getDb(), "videos", v.id), { duration: d }).catch(() => {});
        setItems((prev) => prev.map((x) => (x.id === v.id ? { ...x, duration: d } : x)));
      } catch {
        failed++;
      }
    }
    setProbe("");
    if (failed) setError(`تعذّرت قراءة مدة ${failed} فيديو (صيغة غير مدعومة في المتصفح أو الملف غير مشارك).`);
  }

  async function remove(v: VideoDoc) {
    if (!window.confirm(`حذف «${v.title}» نهائيًا؟ لا يمكن التراجع. (ملف درايف نفسه لن يُحذف)`)) return;
    setBusy(v.id);
    setError("");
    try {
      await deleteDoc(doc(getDb(), "videos", v.id));
      void deleteThumb(v.id);
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


      <div className="admin-filters" role="group" aria-label="تصفية الفيديوهات">
        <div className="field">
          <label htmlFor="f-cat">التصنيف</label>
          <select id="f-cat" value={fCat} onChange={(e) => setFCat(e.target.value)}>
            <option value="">كل التصنيفات</option>
            <option value={NONE}>بدون تصنيف</option>
            {categories.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-ser">السلسلة</label>
          <select id="f-ser" value={fSer} onChange={(e) => setFSer(e.target.value)}>
            <option value="">كل السلاسل</option>
            <option value={NONE}>بدون سلسلة</option>
            {series.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-vis">الظهور</label>
          <select id="f-vis" value={fVis} onChange={(e) => setFVis(e.target.value as "all" | "visible" | "hidden")}>
            <option value="all">الكل</option>
            <option value="visible">المعروض للزوار</option>
            <option value="hidden">المخفي</option>
          </select>
        </div>
        {(fCat || fSer || fVis !== "all") && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setFCat(""); setFSer(""); setFVis("all"); }}>مسح التصفية</button>
        )}
      </div>
      {!loading && items.some((v) => v.driveId && !v.duration) && (
        <div className="addrow">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void fetchDurations()} disabled={Boolean(probe)}>
            {probe || `جلب مدد ${items.filter((v) => v.driveId && !v.duration).length} فيديو (لتظهر على الصور)`}
          </button>
        </div>
      )}
      {!loading && shown.length > 0 && (
        <div className="addrow">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() =>
            setSel((s0) => {
              const n = new Set(s0);
              pageItems.forEach((v) => (allShownSelected ? n.delete(v.id) : n.add(v.id)));
              return n;
            })
          }>
            {allShownSelected ? "إلغاء تحديد هذه الصفحة" : `تحديد كل الصفحة (${pageItems.length})`}
          </button>
          {sel.size > 0 && <small className="hint">المحدَّد: {sel.size}</small>}
        </div>
      )}
      {sel.size > 0 && (
        <div className="panel bulk-bar" role="region" aria-label="تعديل جماعي">
          <strong>تعديل {sel.size} فيديو معًا</strong>
          <div className="addrow">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void bulkAction("hide")} disabled={bulkBusy}>إخفاء المحدَّد</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void bulkAction("show")} disabled={bulkBusy}>إظهار المحدَّد</button>
            <button type="button" className="btn btn--ghost btn--sm danger" onClick={() => void bulkAction("delete")} disabled={bulkBusy}>حذف المحدَّد</button>
          </div>
          <label className="check"><input type="checkbox" checked={chgCat} onChange={(e) => setChgCat(e.target.checked)} /> تغيير التصنيف</label>
          {chgCat && (
            <CreatableSelect label="التصنيف الجديد" items={categories.items} value={bulkCat} onChange={setBulkCat} onCreate={categories.create}
              placeholder="اختر التصنيف" newLabel="إضافة تصنيف جديد…" newPlaceholder="اسم التصنيف الجديد" disabled={categories.loading} />
          )}
          <label className="check"><input type="checkbox" checked={chgSer} onChange={(e) => setChgSer(e.target.checked)} /> تغيير السلسلة</label>
          {chgSer && (
            <>
              <CreatableSelect label="السلسلة الجديدة" items={series.items} value={bulkSer} onChange={setBulkSer} onCreate={series.create}
                placeholder="بدون سلسلة (إزالة)" newLabel="إضافة سلسلة جديدة…" newPlaceholder="اسم السلسلة الجديدة" disabled={series.loading} />
              <p className="hint">ترك الاختيار «بدون سلسلة» يزيل السلسلة والموسم والحلقة من المحدَّدين. عند النقل لسلسلة تبقى أرقام الموسم والحلقة كما هي ويمكن تعديلها لكل فيديو.</p>
            </>
          )}
          <div className="addrow">
            <button type="button" onClick={() => void applyBulk()} disabled={bulkBusy}>{bulkBusy ? "جارٍ التطبيق…" : "تطبيق على المحدَّدين"}</button>
            <button type="button" className="btn btn--ghost" onClick={() => setSel(new Set())} disabled={bulkBusy}>إلغاء التحديد</button>
          </div>
        </div>
      )}
      {bulkMsg && <p className="hint" role="status">{bulkMsg}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {loading ? (
        <p className="empty-note" role="status">جارٍ التحميل…</p>
      ) : shown.length === 0 ? (
        <p className="empty-note">{shortsOnly ? "لا توجد مقاطع قصيرة بعد." : "لا توجد فيديوهات."}</p>
      ) : (
        <ul className="alist">
          {pageItems.map((v) => (
            <li key={v.id} className="arow">
              {clipping === v.id ? (
                <ClipEditor
                  video={v}
                  categories={categories}
                  onCancel={() => setClipping("")}
                  onCreated={() => { setClipping(""); setBulkMsg("تم نشر المقطع الطولي في قسم «قصيرة» ✓"); setTick((t) => t + 1); }}
                />
              ) : editing === v.id ? (
                <EditForm video={v} categories={categories} series={series} onCancel={() => setEditing("")} onSaved={(nv) => { replace(nv); setEditing(""); }} />
              ) : (
                <>
                  <div className="arow-thumb">
                    <input type="checkbox" className="arow-pick" aria-label={`تحديد ${v.title}`} checked={sel.has(v.id)} onChange={() => toggle(v.id)} />
                    {v.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                  </div>
                  <div className="arow-info">
                    <Link href={`/v/${v.id}`}><strong>{v.title}</strong></Link>
                    <small>{[v.categoryName, v.seriesName].filter(Boolean).join(" • ") || "بدون تصنيف"}{v.duration ? ` • ${formatClock(v.duration)}` : ""}</small>
                    <span className="badges">
                      {v.isShort && <b className="badge">{v.clip ? "مقتطع" : "قصير"}</b>}
                      {v.hidden && <b className="badge badge--off">مخفي</b>}
                    </span>
                  </div>
                  <div className="arow-actions" role="group" aria-label={`إجراءات ${v.title}`}>
                    <button type="button" className="iconbtn" title="تعديل" aria-label="تعديل" onClick={() => setEditing(v.id)} disabled={busy === v.id}>
                      <Icon name="edit" size={18} />
                    </button>
                    <button type="button" className="iconbtn" title={v.hidden ? "إظهار للزوار" : "إخفاء عن الزوار"} aria-label={v.hidden ? "إظهار" : "إخفاء"} onClick={() => void patch(v, { hidden: !v.hidden })} disabled={busy === v.id}>
                      <Icon name={v.hidden ? "eye" : "eyeoff"} size={18} />
                    </button>
                    <button type="button" className={v.isShort ? "iconbtn on" : "iconbtn"} title={v.isShort ? "إلغاء «قصير»" : "اجعله قصيرًا"} aria-label={v.isShort ? "إلغاء «قصير»" : "اجعله قصيرًا"} aria-pressed={v.isShort} onClick={() => void patch(v, { isShort: !v.isShort })} disabled={busy === v.id}>
                      <Icon name="bolt" size={18} />
                    </button>
                    {v.driveId && !v.clip && (
                      <button type="button" className="iconbtn" title="اقتصاص مقطع طولي (شورتس)" aria-label="اقتصاص مقطع طولي" onClick={() => setClipping(v.id)} disabled={busy === v.id}>
                        <Icon name="scissors" size={18} />
                      </button>
                    )}
                    <button type="button" className="iconbtn danger" title="حذف" aria-label="حذف" onClick={() => void remove(v)} disabled={busy === v.id}>
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!loading && lastPage > 1 && (
        <nav className="pager" aria-label="صفحات الفيديوهات">
          <button type="button" className="pager-btn" aria-label="الصفحة السابقة" disabled={cur === 1} onClick={() => goTo(cur - 1)}>›</button>
          {pageList(cur, lastPage).map((n, i) =>
            n === "gap" ? (
              <span key={`g${i}`} className="pager-gap" aria-hidden="true">…</span>
            ) : (
              <button key={n} type="button" className={n === cur ? "pager-btn on" : "pager-btn"} aria-label={`صفحة ${n}`} aria-current={n === cur ? "page" : undefined} onClick={() => goTo(n)}>{n}</button>
            ),
          )}
          <button type="button" className="pager-btn" aria-label="الصفحة التالية" disabled={cur === lastPage} onClick={() => goTo(cur + 1)}>‹</button>
        </nav>
      )}
      {!loading && shown.length > 0 && <p className="hint pager-info">عرض {(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, shown.length)} من {shown.length}</p>}
    </div>
  );
}
