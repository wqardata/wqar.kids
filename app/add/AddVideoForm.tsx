"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import { useAuth } from "@/lib/auth";
import { driveThumbnail, parseDriveId } from "@/lib/drive";
import { getDb } from "@/lib/firebase";
import { useNamedList } from "@/lib/videos";

type Info = { id: string; title: string | null; thumbnail: string; warning: string | null };
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

  const driveId = parseDriveId(url);

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
          setInfo({ id: driveId, title: null, thumbnail: driveThumbnail(driveId), warning: null });
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
      const ref = await addDoc(collection(getDb(), "videos"), {
        title: title.trim(),
        driveId,
        thumbnail: driveThumbnail(driveId),
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
      </div>

      {info && driveId && (
        <div className="preview">
          <div className="preview-thumb">
            {thumbOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.thumbnail} alt="" referrerPolicy="no-referrer" onError={() => setThumbOk(false)} />
            ) : (
              <span>لا توجد صورة مصغّرة</span>
            )}
          </div>
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
        label="السلسلة (اختياري)"
        items={series.items}
        value={seriesId}
        onChange={setSeriesId}
        onCreate={series.create}
        placeholder="بدون سلسلة"
        newLabel="إضافة سلسلة جديدة…"
        newPlaceholder="اسم السلسلة الجديدة"
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
      <button type="submit" disabled={saving || !driveId}>{saving ? "جارٍ الحفظ…" : "نشر الفيديو"}</button>
    </form>
  );
}
