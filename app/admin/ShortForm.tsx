"use client";
import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import { useAuth } from "@/lib/auth";
import { driveThumbnail } from "@/lib/drive";
import { useDriveInfo } from "@/lib/driveInfo";
import { getDb } from "@/lib/firebase";
import { useNamedList } from "@/lib/videos";

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
      await addDoc(collection(getDb(), "videos"), {
        title: title.trim(),
        driveId,
        thumbnail: driveThumbnail(driveId),
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
      setUrl("");
      setTitle("");
      setDescription("");
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
      </div>
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
      <button type="submit" disabled={saving || !driveId}>{saving ? "جارٍ الحفظ…" : "نشر المقطع"}</button>
    </form>
  );
}
