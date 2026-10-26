"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import { useAuth } from "@/lib/auth";
import { getDb } from "@/lib/firebase";
import { fetchYouTubeTitle, parseYouTubeId, youtubeThumbnail } from "@/lib/youtube";
import { useNamedList } from "@/lib/videos";

/** إضافة فيديو من رابط يوتيوب (يُشغَّل بمشغّل يوتيوب الرسمي، وتُؤخذ صورته من يوتيوب). */
export default function AddYouTubeForm() {
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
  const [short, setShort] = useState(false);
  const [msg, setMsg] = useState("");
  const [thumbOk, setThumbOk] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ytId = parseYouTubeId(url);

  // جلب العنوان تلقائيًا بمجرد لصق رابط صالح.
  useEffect(() => {
    setThumbOk(true);
    if (!ytId) { setMsg(""); return; }
    let off = false;
    setMsg("جارٍ جلب العنوان…");
    const t = setTimeout(async () => {
      const name = await fetchYouTubeTitle(ytId);
      if (off) return;
      if (name) { setTitle(name); setMsg("تم جلب العنوان ✓"); }
      else setMsg("تعذّر جلب العنوان تلقائيًا (قد يكون الفيديو خاصًا أو التضمين معطّلًا)، اكتبه يدويًا.");
    }, 350);
    return () => { off = true; clearTimeout(t); };
  }, [ytId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !ytId) return;
    if (!title.trim()) return setError("اكتب عنوان الفيديو.");
    if (!categoryId) return setError("اختر التصنيف.");
    setSaving(true);
    setError("");
    try {
      const cat = categories.items.find((c) => c.id === categoryId);
      const ser = series.items.find((s) => s.id === seriesId);
      const num = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Math.max(1, Math.floor(Number(v))) : null);
      const ref = doc(collection(getDb(), "videos"));
      await setDoc(ref, {
        title: title.trim(),
        driveId: "",
        youtubeId: ytId,
        thumbnail: youtubeThumbnail(ytId),
        duration: null,
        description: description.trim(),
        categoryId,
        categoryName: cat?.name ?? "",
        seriesId: ser?.id ?? "",
        seriesName: ser?.name ?? "",
        season: ser ? num(season) : null,
        episode: ser ? num(episode) : null,
        isShort: short,
        createdBy: user.uid,
        createdByEmail: user.email ?? "",
        createdAt: serverTimestamp(),
      });
      router.push(`/v/${ref.id}`);
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore.");
      setSaving(false);
    }
  }

  if (!configured) return <p className="note">لم يُضبط Firebase بعد — راجع README.</p>;
  if (loading) return <p className="note" role="status">جارٍ التحميل…</p>;
  if (!user) {
    return (
      <>
        <p className="note">يجب تسجيل الدخول لإضافة فيديو.</p>
        <Link href="/login" className="btn">تسجيل الدخول بجوجل</Link>
      </>
    );
  }
  if (!canAdd) return <p className="note" role="alert">حسابك ({user.email}) غير مخوّل بإضافة فيديوهات.</p>;

  return (
    <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
      <div className="field">
        <label htmlFor="yt-url">رابط الفيديو من يوتيوب</label>
        <input
          id="yt-url"
          type="text"
          dir="ltr"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…  أو  https://youtu.be/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          autoComplete="off"
        />
        {url.trim() && !ytId && <p className="field-error" role="alert">الرابط لا يبدو رابط فيديو من يوتيوب.</p>}
        <p className="hint" role="status" aria-live="polite">{msg}</p>
      </div>

      {ytId && (
        <div className="field">
          <div className="preview">
            <div className="preview-thumb">
              {thumbOk ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={youtubeThumbnail(ytId)} alt="" referrerPolicy="no-referrer" onError={() => setThumbOk(false)} />
              ) : (
                <span>لا توجد صورة مصغّرة</span>
              )}
            </div>
          </div>
          <p className="hint">ستُستخدم صورة يوتيوب المصغّرة. المدة لا تُجلب تلقائيًا لفيديوهات يوتيوب.</p>
        </div>
      )}

      <div className="field">
        <label htmlFor="yt-title">عنوان الفيديو</label>
        <input id="yt-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
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
            <label htmlFor="yt-season">الموسم</label>
            <input id="yt-season" type="number" min={1} inputMode="numeric" value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="yt-ep">رقم الحلقة</label>
            <input id="yt-ep" type="number" min={1} inputMode="numeric" value={episode} onChange={(e) => setEpisode(e.target.value)} />
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="yt-desc">الوصف (اختياري)</label>
        <textarea id="yt-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="submit" disabled={saving || !ytId}>{saving ? "جارٍ الحفظ…" : "نشر الفيديو"}</button>
    </form>
  );
}
