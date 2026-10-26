"use client";
import RowIcon from "@/components/RowIcon";
import { ROW_ICONS, rowIconById } from "@/lib/rowIcons";

/** منتقي أيقونة عنوان الصف من المكتبة (أكثر من 50 أيقونة)، مع خيار «بدون أيقونة». */
export default function IconPicker({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const cur = value ? rowIconById(value) : undefined;
  return (
    <details className="icon-picker">
      <summary id={id}>
        <span className="icon-picker-cur" aria-hidden="true">{cur ? <RowIcon id={cur.id} size={22} /> : "—"}</span>
        <span>{label}: {cur ? cur.label : "بدون أيقونة"}</span>
      </summary>
      <div className="icon-grid" role="radiogroup" aria-labelledby={id}>
        <button type="button" role="radio" aria-checked={!value} className={!value ? "icon-opt on" : "icon-opt"} title="بدون أيقونة" aria-label="بدون أيقونة" onClick={() => onChange("")}>
          <span aria-hidden="true">∅</span>
        </button>
        {ROW_ICONS.map((ic) => (
          <button key={ic.id} type="button" role="radio" aria-checked={value === ic.id} className={value === ic.id ? "icon-opt on" : "icon-opt"} title={ic.label} aria-label={ic.label} onClick={() => onChange(ic.id)}>
            <RowIcon id={ic.id} size={22} />
          </button>
        ))}
      </div>
    </details>
  );
}
