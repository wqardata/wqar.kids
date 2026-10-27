"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Timestamp, collection, doc, getDocs, limit, orderBy, query, writeBatch } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import { useAuth } from "@/lib/auth";
import { driveThumbnail, parseFolderId } from "@/lib/drive";
import { getDb } from "@/lib/firebase";
import { formatClock } from "@/lib/format";
import { bumpVideosVersion, useNamedList } from "@/lib/videos";

type Row = { id: string; name: string; title: string; duration: number | null; path: string; exists: boolean; on: boolean };

/** استيراد كل فيديوهات مجلد درايف دفعة واحدة. */
export default function FolderImport() {
  const { user, loading, configured, canAdd } = useAuth();
  const categories = useNamedList("categories");
  const series = useNamedList("series");

  const [url, setUrl] = useState("");
  const [deep, setDeep] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [fetching, setFetching] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [season, setSeason] = useState("1");
  const [numbering, setNumbering] = useState(true);
  const [startEp, setStartEp] = useState("1");
  const [hidden, setHidden] = useState(true);
  // مجموعة جديدة باسم المجلد (الافتراضي)، أو اختيار مجموعة موجودة.
  const [folderSeries, setFolderSeries] = useState(true);
  const [seriesName, setSeriesName] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const [known, setKnown] = useState<Set<string>>(new Set());

  const folderId = parseFolderId(url);

  // معرّفات درايف المضافة سابقًا، لتمييز المكرر وعدم استيراده مرتين.
  useEffect(() => {
    if (!user) return;
    let off = false;
    getDocs(query(collection(getDb(), "videos"), orderBy("createdAt", "desc"), limit(1000)))
      .then((snap) => !off && setKnown(new Set(snap.docs.map((d) => String(d.data().driveId ?? "")).filter(Boolean))))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [user]);

  async function load() {
    if (!user || !folderId) return;
    setFetching(true);
    setError("");
    setNote("");
    setRows([]);
    setDoneCount(0);
    try {
      const token = await user.getIdToken();
      const r = await fetch(`/api/drive-folder?id=${encodeURIComponent(folderId)}&deep=${deep ? 1 : 0}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) return setError(j.error ?? "تعذّر قراءة المجلد.");
      const list = (j.videos as Omit<Row, "exists" | "on">[]).map((v) => ({ ...v, exists: known.has(v.id), on: !known.has(v.id) }));
      setRows(list);
      setSeriesName(typeof j.folderName === "string" ? j.folderName : "");
      const parts = [`وُجد ${list.length} فيديو`];
      const dup = list.filter((x) => x.exists).length;
      if (dup) parts.push(`${dup} منها مضاف سابقًا (غير محدَّد)`);
      if (j.skipped) parts.push(`تم تجاهل ${j.skipped} عنصرًا ليس فيديو`);
      if (!j.usedApi && list.length > 0) parts.push("المدد غير متوفرة بدون مفتاح API (ستظهر بعد فتح الفيديو أو من «جلب المدد الناقصة»)");
      if (j.truncated) parts.push("القائمة مقتطعة عند الحد الأقصى (500 فيديو)");
      setNote(parts.join(" • "));
    } catch {
      setError("تعذّر الاتصال. حاول مرة أخرى.");
    } finally {
      setFetching(false);
    }
  }

  const selected = useMemo(() => rows.filter((r) => r.on), [rows]);
  const setRow = (id: string, patch: Partial<Row>) => setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function importAll() {
    if (!user) return;
    if (selected.length === 0) return setError("حدّد فيديو واحدًا على الأقل.");
    if (!categoryId) return setError("اختر التصنيف.");
    if (folderSeries && !seriesName.trim()) return setError("اكتب اسم المجموعة (اسم المجلد).");
    if (selected.some((r) => !r.title.trim())) return setError("بعض العناوين فارغة.");
    setSaving(true);
    setError("");
    setDoneCount(0);
    try {
      const cat = categories.items.find((c) => c.id === categoryId);
      // مجموعة باسم المجلد: تُنشأ الآن (أو تُستخدم الموجودة بنفس الاسم دون تكرار).
      const serId = folderSeries ? await series.create(seriesName) : seriesId;
      const ser = folderSeries ? { id: serId, name: seriesName.trim().replace(/\s+/g, " ") } : series.items.find((s) => s.id === seriesId);
      const num = (v: string, d: number) => (v.trim() && Number.isFinite(Number(v)) ? Math.max(1, Math.floor(Number(v))) : d);
      const first = num(startEp, 1);
      const sn = ser ? num(season, 1) : null;
      const base = Date.now();
      const db = getDb();
      let done = 0;
      for (let i = 0; i < selected.length; i += 400) {
        const batch = writeBatch(db);
        selected.slice(i, i + 400).forEach((r, k) => {
          const n = i + k;
          batch.set(doc(collection(db, "videos")), {
            title: r.title.trim().slice(0, 150),
            driveId: r.id,
            thumbnail: driveThumbnail(r.id),
            duration: r.duration,
            description: "",
            categoryId,
            categoryName: cat?.name ?? "",
            seriesId: ser?.id ?? "",
            seriesName: ser?.name ?? "",
            season: sn,
            episode: ser && numbering ? first + n : null,
            isShort: false,
            hidden,
            createdBy: user.uid,
            createdByEmail: user.email ?? "",
            // ترتيب زمني متصاعد يحفظ ترتيب الأسماء.
            createdAt: Timestamp.fromMillis(base + n),
          });
        });
        setProgress(`جارٍ الحفظ… ${Math.min(i + 400, selected.length)} من ${selected.length}`);
        await batch.commit();
        bumpVideosVersion();
        done += Math.min(400, selected.length - i);
        setDoneCount(done);
      }
      setKnown((k) => new Set([...k, ...selected.map((r) => r.id)]));
      setRows((p) => p.map((r) => (r.on ? { ...r, exists: true, on: false } : r)));
    } catch {
      setError("تعذّر إكمال الاستيراد. تأكد من صلاحياتك وقواعد Firestore. (قد يكون جزء من الفيديوهات حُفظ؛ أعد تحميل المجلد لترى المكرر.)");
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  if (!configured) return <p className="note">لم يُضبط Firebase بعد — راجع README.</p>;
  if (loading) return <p className="note" role="status">جارٍ التحميل…</p>;
  if (!user) return (<><p className="note">يجب تسجيل الدخول أولًا.</p><Link href="/login" className="btn">تسجيل الدخول بجوجل</Link></>);
  if (!canAdd) return <p className="note" role="alert">حسابك ({user.email}) غير مخوّل بإضافة فيديوهات.</p>;

  return (
    <div className="auth-form">
      <div className="field">
        <label htmlFor="folder-url">رابط المجلد من جوجل درايف</label>
        <input id="folder-url" type="url" dir="ltr" inputMode="url" placeholder="https://drive.google.com/drive/folders/…" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
        {url.trim() && !folderId && <p className="field-error" role="alert">الرابط لا يبدو رابط مجلد من درايف.</p>}
        <p className="hint">يجب أن يكون المجلد مشاركًا «أي شخص لديه الرابط – مشاهد». لا حاجة لمفتاح API: بدونه تُقرأ صفحة المجلد العامة (بلا مدة الفيديو)، ومعه تُجلب المدة أيضًا.</p>
      </div>
      <label className="check"><input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> تضمين المجلدات الفرعية</label>
      <div className="addrow">
        <button type="button" onClick={() => void load()} disabled={!folderId || fetching || saving}>{fetching ? "جارٍ قراءة المجلد…" : "عرض فيديوهات المجلد"}</button>
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}
      {note && <p className="hint" role="status">{note}</p>}

      {rows.length > 0 && (
        <>
          <div className="addrow">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRows((p) => p.map((r) => ({ ...r, on: !r.exists })))}>تحديد الكل</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRows((p) => p.map((r) => ({ ...r, on: false })))}>إلغاء التحديد</button>
            <small className="hint">المحدَّد: {selected.length}</small>
          </div>
          <ul className="alist import-list">
            {rows.map((r) => (
              <li key={r.id} className="import-row">
                <input type="checkbox" aria-label={`استيراد ${r.title}`} checked={r.on} disabled={saving} onChange={(e) => setRow(r.id, { on: e.target.checked })} />
                <div className="arow-info">
                  <input aria-label="العنوان" value={r.title} maxLength={150} disabled={saving} onChange={(e) => setRow(r.id, { title: e.target.value })} />
                  <small>
                    {r.duration ? formatClock(r.duration) : "المدة غير معروفة"}
                    {r.path && ` • ${r.path}`}
                    {r.exists && " • مضاف سابقًا"}
                  </small>
                </div>
              </li>
            ))}
          </ul>

          <CreatableSelect label="التصنيف" items={categories.items} value={categoryId} onChange={setCategoryId} onCreate={categories.create}
            placeholder="اختر التصنيف" newLabel="إضافة تصنيف جديد…" newPlaceholder="اسم التصنيف الجديد" required disabled={categories.loading} />
          <label className="check"><input type="checkbox" checked={folderSeries} onChange={(e) => setFolderSeries(e.target.checked)} /> إنشاء مجموعة باسم المجلد ووضع الفيديوهات فيها</label>
          {folderSeries ? (
            <div className="field">
              <label htmlFor="fi-series-name">اسم المجموعة</label>
              <input id="fi-series-name" value={seriesName} maxLength={100} onChange={(e) => setSeriesName(e.target.value)} disabled={saving} />
              <p className="hint">يُملأ باسم المجلد تلقائيًا، ويمكنك تعديله. إن وُجدت مجموعة بنفس الاسم تُستعمل بدل إنشاء نسخة ثانية.</p>
            </div>
          ) : (
            <CreatableSelect label="المجموعة (اختياري)" items={series.items} value={seriesId} onChange={setSeriesId} onCreate={series.create}
              placeholder="بدون مجموعة" newLabel="إضافة مجموعة جديدة…" newPlaceholder="اسم المجموعة الجديدة" disabled={series.loading} />
          )}
          {(folderSeries || seriesId) && (
            <>
              <div className="two">
                <div className="field">
                  <label htmlFor="fi-season">الموسم</label>
                  <input id="fi-season" type="number" min={1} inputMode="numeric" value={season} onChange={(e) => setSeason(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="fi-ep">رقم أول حلقة</label>
                  <input id="fi-ep" type="number" min={1} inputMode="numeric" value={startEp} onChange={(e) => setStartEp(e.target.value)} disabled={!numbering} />
                </div>
              </div>
              <label className="check"><input type="checkbox" checked={numbering} onChange={(e) => setNumbering(e.target.checked)} /> ترقيم الحلقات تلقائيًا بترتيب الأسماء</label>
            </>
          )}
          <label className="check"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> استيرادها مخفية عن الزوار حتى أراجعها (مفعّل افتراضيًا؛ تُظهرها لاحقًا من لوحة التحكم)</label>
          <p className="hint">تُستخدم صورة درايف المصغّرة الافتراضية، ويمكنك تغيير أي صورة لاحقًا من لوحة التحكم.</p>
          {progress && <p className="hint" role="status">{progress}</p>}
          {doneCount > 0 && !saving && <p className="hint" role="status">تم استيراد {doneCount} فيديو ✓ — <Link href="/admin">فتح لوحة التحكم</Link></p>}
          <button type="button" onClick={() => void importAll()} disabled={saving || selected.length === 0}>{saving ? "جارٍ الاستيراد…" : `استيراد ${selected.length} فيديو`}</button>
        </>
      )}
    </div>
  );
}
