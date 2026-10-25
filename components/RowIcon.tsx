import { rowIconById } from "@/lib/rowIcons";

/** أيقونة من مكتبة عناوين الصفوف. معرّف غير معروف أو فارغ = لا شيء. */
export default function RowIcon({ id, size = 22 }: { id: string; size?: number }) {
  const ic = id ? rowIconById(id) : undefined;
  if (!ic) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={ic.d} />
    </svg>
  );
}

/** عنوان صف: الأيقونة على اليمين (بداية السطر في الواجهة العربية) ثم النص. */
export function RowTitle({ text, icon, id }: { text: string; icon: string; id?: string }) {
  if (!text) return null;
  return (
    <div className="row-head">
      <h2 id={id} className="row-title">
        {icon && <span className="row-title-ic"><RowIcon id={icon} size={22} /></span>}
        <span>{text}</span>
      </h2>
    </div>
  );
}
