"use client";
import { useState, type FormEvent } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import CreatableSelect from "@/components/CreatableSelect";
import { useAuth } from "@/lib/auth";
import { driveThumbnail } from "@/lib/drive";
import { getDb } from "@/lib/firebase";
import { formatClock } from "@/lib/format";
import { deleteThumb, saveThumb } from "@/lib/thumbs";
import { useRandomFrame } from "@/lib/useRandomFrame";
import { bumpVideosVersion, type useNamedList, type VideoDoc } from "@/lib/videos";

type NamedList = ReturnType<typeof useNamedList>;

/** نموذج تعديل فيديو (العنوان، الوصف، الصورة، المجموعة…). يُستعمل في قائمة الفيديوهات وفي صفحة عرض الفيديو. */
export default function VideoEditForm({ video, categories, series, onSaved, onCancel }: {
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
        // نقل الفيديو إلى مجموعة أخرى يُسقط ترتيبه القديم (يلحق بآخر المجموعة الجديدة حتى يُرتَّب).
        seriesOrder: (ser?.id ?? "") === video.seriesId ? video.seriesOrder : null,
      };
      await updateDoc(doc(getDb(), "videos", video.id), { ...patch, updatedAt: serverTimestamp() });
      bumpVideosVersion();
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
      <CreatableSelect label="المجموعة" items={series.items} value={seriesId} onChange={setSeriesId} onCreate={series.create}
        placeholder="بدون مجموعة" newLabel="إضافة مجموعة جديدة…" newPlaceholder="اسم المجموعة الجديدة" disabled={series.loading} />
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

