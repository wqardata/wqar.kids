"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import { useAuth } from "@/lib/auth";
import { driveThumbnail, parseDriveId } from "@/lib/drive";
import { getDb } from "@/lib/firebase";
import { deleteThumb, saveThumb } from "@/lib/thumbs";
import { useRandomFrame } from "@/lib/useRandomFrame";
import { formatClock } from "@/lib/format";
import { bumpVideosVersion, useNamedList } from "@/lib/videos";

type Info = { id: string; title: string | null; thumbnail: string; duration: number | null; warning: string | null };
type Fetch = "idle" | "loading" | "ok" | "error";

export default function AddVideoForm() {
  const { user, loading, configured, canAdd } = useAuth();
  const router = useRouter();
  const categories = useNamedList("categories");
  const series = useNamedList("series");

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");

  const [status, setStatus] = useState<Fetch>("idle");
  const [info, setInfo] = useState<Info | null>(null);
  const [fetchMsg, setFetchMsg] = useState("");
  const [thumbOk, setThumbOk] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // لقطة عشوائية بعد الثانية 10 بدل صورة درايف الافتراضية.
  const [randomThumb, setRandomThumb] = useState(false); // افتراضيًا صورة درايف المصغّرة (توفيرًا للباقة)

  const driveId = parseDriveId(url);
  // المدة: من Drive API إن توفّر (DRIVE_API_KEY)، وإلا من البيانات الوصفية للفيديو نفسه في المتصفح.
  const apiDuration = info?.duration ?? null;
  const needMeta = !randomThumb && (status === "ok" || status === "error") && apiDuration == null;
  const frame = useRandomFrame(driveId, user, randomThumb || needMeta, randomThumb);
  const capturing = randomThumb && frame.status === "loading";
  const duration = apiDuration ?? (frame.duration > 0 ? frame.duration : null);

  // جلب الاسم والصورة تلقائيًا بمجرد لصق رابط صالح.
  useEffect(() => {
    if (!user || !driveId) {
      setInfo(null);
      setStatus("idle");
      setFetchMsg("");
      return;
    }
    let off = false;
    setStatus("loading");
    setFetchMsg("");
    setThumbOk(true);
    const t = setTimeout(async () => {
      try {
        const token = await user.getIdToken();
        const r = await fetch(`/api/drive-info?id=${encodeURIComponent(driveId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const j = await r.json();
        if (off) return;
        if (!r.ok) {
          setStatus("error");
          setInfo({ id: driveId, title: null, thumbnail: driveThumbnail(driveId), duration: null, warning: null });
          setFetchMsg(j.error ?? "تعذّر جلب بيانات الملف.");
          return;
        }
        setInfo(j as Info);
        setStatus("ok");
        setFetchMsg((j as Info).warning ?? "");
        if ((j as Info).title) setTitle((j as Info).title as string);
      } catch {
        if (!off) {
          setStatus("error");
          setFetchMsg("تعذّر الاتصال. حاول مرة أخرى.");
        }
      }
    }, 350);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [driveId, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !driveId) return;
    if (!title.trim()) return setError("اكتب عنوان الفيديو.");
    if (!categoryId) return setError("اختر التصنيف.");
    setSaving(true);
    setError("");
    try {
      const cat = categories.items.find((c) => c.id === categoryId);
      const ser = series.items.find((s) => s.id === seriesId);
      const num = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Math.max(1, Math.floor(Number(v))) : null);
      const ref = doc(collection(getDb(), "videos"));
      let thumbnail = driveThumbnail(driveId);
      let savedThumb = false;
      if (randomThumb && frame.status === "ok" && frame.dataUrl) {
        try {
          thumbnail = await saveThumb(ref.id, frame.dataUrl);
          savedThumb = true;
        } catch {
          // لا نكمل بصمت بصورة مختلفة عمّا رآه المشرف في المعاينة.
          setError("تعذّر حفظ الصورة المختارة. حدّث قواعد Firestore (thumbs) من firestore.rules أو ألغِ خيار «لقطة عشوائية».");
          setSaving(false);
          return;
        }
      }
      try {
        await setDoc(ref, {
          title: title.trim(),
          driveId,
          thumbnail,
          duration,
          description: description.trim(),
          categoryId,
          categoryName: cat?.name ?? "",
          seriesId: ser?.id ?? "",
          seriesName: ser?.name ?? "",
          season: ser ? num(season) : null,
          episode: ser ? num(episode) : null,
          createdBy: user.uid,
          createdByEmail: user.email ?? "",
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        if (savedThumb) void deleteThumb(ref.id);
        throw e;
      }
      bumpVideosVersion();
      router.push(`/v/${ref.id}`);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore.");
      setSaving(false);
    }
  }

  if (!configured) {
    return <p className="note">لم يُضبط Firebase بعد — راجع README.</p>;
  }
  if (loading) return <p className="note" role="status">جارٍ التحميل…</p>;
  if (!user) {
    return (
      <>
        <p className="note">يجب تسجيل الدخول لإضافة فيديو.</p>
        <Link href="/login" className="btn">تسجيل الدخول بجوجل</Link>
      </>
    );
  }
  if (!canAdd) {
    return <p className="note" role="alert">حسابك ({user.email}) غير مخوّل بإضافة فيديوهات.</p>;
  }

  return (
    <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
      <div className="field">
        <label htmlFor="drive-url">رابط الفيديو من جوجل درايف</label>
        <input
          id="drive-url"
          type="url"
          dir="ltr"
          inputMode="url"
          placeholder="https://drive.google.com/file/d/…/view"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          autoComplete="off"
        />
        {url.trim() && !driveId && (
          <p className="field-error" role="alert">الرابط لا يبدو رابط ملف من درايف.</p>
        )}
        <p className="hint" role="status" aria-live="polite">
          {status === "loading" && "جارٍ جلب الاسم والصورة…"}
          {status === "ok" && !fetchMsg && "تم جلب بيانات الملف ✓"}
          {fetchMsg}
        </p>
        {driveId && info && (
          <p className="hint" role="status" aria-live="polite">
            {duration ? `مدة الفيديو: ${formatClock(duration)} ✓` : "جارٍ قراءة مدة الفيديو…"}
          </p>
        )}
      </div>

      {info && driveId && (
        <div className="field">
          <div className="preview">
            <div className="preview-thumb">
              {frame.status === "ok" && frame.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frame.dataUrl} alt="" />
              ) : thumbOk ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.thumbnail} alt="" referrerPolicy="no-referrer" onError={() => setThumbOk(false)} />
              ) : (
                <span>لا توجد صورة مصغّرة</span>
              )}
              {capturing && <span className="preview-busy" role="status">جارٍ التقاط صورة من الفيديو…</span>}
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={randomThumb} onChange={(e) => setRandomThumb(e.target.checked)} />
            التقاط صورة عشوائية بعد الثانية 10 من الفيديو
          </label>
          {randomThumb && frame.status === "ok" && (
            <div className="addrow">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void frame.reroll()} disabled={!frame.canReroll}>
                🎲 لقطة أخرى
              </button>
              <small className="hint">اللقطة من الثانية {formatClock(frame.time)}</small>
            </div>
          )}
          {randomThumb && frame.message && <p className="hint" role="status">{frame.message}</p>}
          {!randomThumb && <p className="hint">ستُستخدم صورة درايف المصغّرة الافتراضية.</p>}
        </div>
      )}

      <div className="field">
        <label htmlFor="v-title">عنوان الفيديو</label>
        <input id="v-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
      </div>

      <CreatableSelect
        label="التصنيف"
        items={categories.items}
        value={categoryId}
        onChange={setCategoryId}
        onCreate={categories.create}
        placeholder="اختر التصنيف"
        newLabel="إضافة تصنيف جديد…"
        newPlaceholder="اسم التصنيف الجديد"
        required
        disabled={categories.loading}
      />

      <CreatableSelect
        label="المجموعة (اختياري)"
        items={series.items}
        value={seriesId}
        onChange={setSeriesId}
        onCreate={series.create}
        placeholder="بدون مجموعة"
        newLabel="إضافة مجموعة جديدة…"
        newPlaceholder="اسم المجموعة الجديدة"
        disabled={series.loading}
      />

      {seriesId && (
        <div className="two">
          <div className="field">
            <label htmlFor="v-season">الموسم</label>
            <input id="v-season" type="number" min={1} inputMode="numeric" value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="v-ep">رقم الحلقة</label>
            <input id="v-ep" type="number" min={1} inputMode="numeric" value={episode} onChange={(e) => setEpisode(e.target.value)} />
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="v-desc">الوصف (اختياري)</label>
        <textarea id="v-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="submit" disabled={saving || !driveId || capturing}>{saving ? "جارٍ الحفظ…" : capturing ? "جارٍ التقاط الصورة…" : "نشر الفيديو"}</button>
    </form>
  );
}
