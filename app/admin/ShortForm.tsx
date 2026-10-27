"use client";
import { useEffect, useState, type FormEvent } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import { useAuth } from "@/lib/auth";
import { driveThumbnail } from "@/lib/drive";
import { useDriveInfo } from "@/lib/driveInfo";
import { formatClock } from "@/lib/format";
import { getDb } from "@/lib/firebase";
import { deleteThumb, saveThumb } from "@/lib/thumbs";
import { useRandomFrame } from "@/lib/useRandomFrame";
import { bumpVideosVersion, useNamedList } from "@/lib/videos";

/** إنشاء مقطع قصير: ملف درايف مستقل (قصصتَه بأي محرر) يُنشر في قسم «قصيرة». */
export default function ShortForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const categories = useNamedList("categories");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const { driveId, info, status, message } = useDriveInfo(url, user);
  const [randomThumb, setRandomThumb] = useState(false); // افتراضيًا صورة درايف المصغّرة (توفيرًا للباقة)
  const apiDuration = info?.duration ?? null;
  const needMeta = !randomThumb && (status === "ok" || status === "error") && apiDuration == null;
  const frame = useRandomFrame(driveId, user, randomThumb || needMeta, randomThumb);
  const capturing = randomThumb && frame.status === "loading";
  const duration = apiDuration ?? (frame.duration > 0 ? frame.duration : null);

  useEffect(() => {
    if (info?.title) setTitle(info.title);
  }, [info]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !driveId) return;
    if (!title.trim()) return setError("اكتب عنوان المقطع.");
    setSaving(true);
    setError("");
    setDone(false);
    try {
      const cat = categories.items.find((c) => c.id === categoryId);
      const ref = doc(collection(getDb(), "videos"));
      let thumbnail = driveThumbnail(driveId);
      let savedThumb = false;
      if (randomThumb && frame.status === "ok" && frame.dataUrl) {
        try {
          thumbnail = await saveThumb(ref.id, frame.dataUrl);
          savedThumb = true;
        } catch {
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
          categoryId: cat?.id ?? "",
          categoryName: cat?.name ?? "",
          seriesId: "",
          seriesName: "",
          season: null,
          episode: null,
          isShort: true,
          hidden: false,
          createdBy: user.uid,
          createdByEmail: user.email ?? "",
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        if (savedThumb) void deleteThumb(ref.id);
        throw e;
      }
      setUrl("");
      setTitle("");
      setDescription("");
      bumpVideosVersion();
      setDone(true);
      onCreated();
    } catch {
      setError("تعذّر الحفظ. تأكد من صلاحياتك وقواعد Firestore.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="auth-form panel" onSubmit={(e) => void onSubmit(e)}>
      <h2>إنشاء مقطع قصير</h2>
      <p className="hint">ارفع المقطع القصير إلى درايف (شارك: «أي شخص لديه الرابط – مشاهد») ثم الصق رابطه هنا.</p>
      <div className="field">
        <label htmlFor="s-url">رابط المقطع من درايف</label>
        <input id="s-url" type="url" dir="ltr" inputMode="url" placeholder="https://drive.google.com/file/d/…/view" value={url} onChange={(e) => setUrl(e.target.value)} required autoComplete="off" />
        <p className="hint" role="status" aria-live="polite">
          {status === "loading" && "جارٍ جلب الاسم والصورة…"}
          {status === "ok" && !message && "تم جلب بيانات الملف ✓"}
          {message}
        </p>
        {driveId && info && (
          <p className="hint" role="status" aria-live="polite">
            {duration ? `مدة المقطع: ${formatClock(duration)} ✓` : "جارٍ قراءة مدة المقطع…"}
          </p>
        )}
      </div>
      {driveId && (
        <div className="field">
          {randomThumb && frame.status === "ok" && frame.dataUrl && (
            <div className="preview preview--short">
              <div className="preview-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frame.dataUrl} alt="" />
              </div>
            </div>
          )}
          {capturing && <p className="hint" role="status">جارٍ التقاط صورة من المقطع…</p>}
          <label className="check">
            <input type="checkbox" checked={randomThumb} onChange={(e) => setRandomThumb(e.target.checked)} />
            التقاط صورة عشوائية بعد الثانية 10 من المقطع
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
        </div>
      )}
      <div className="field">
        <label htmlFor="s-title">العنوان</label>
        <input id="s-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
      </div>
      <CreatableSelect
        label="التصنيف (اختياري)"
        items={categories.items}
        value={categoryId}
        onChange={setCategoryId}
        onCreate={categories.create}
        placeholder="بدون تصنيف"
        newLabel="إضافة تصنيف جديد…"
        newPlaceholder="اسم التصنيف الجديد"
        disabled={categories.loading}
      />
      <div className="field">
        <label htmlFor="s-desc">الوصف (اختياري)</label>
        <textarea id="s-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="hint" role="status">تم نشر المقطع ✓</p>}
      <button type="submit" disabled={saving || !driveId || capturing}>{saving ? "جارٍ الحفظ…" : capturing ? "جارٍ التقاط الصورة…" : "نشر المقطع"}</button>
    </form>
  );
}
