import { ageShort, viewsCount } from "@/lib/format";

const ICON = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false } as const;

/** 👁 عدد المشاهدات و🕐 مدة الإضافة (بأيقونتين بدل الكلمات). يُستعمل تحت البطاقات والمقترحات والمقاطع القصيرة. */
export default function VideoStats({ views, createdAt }: { views: number; createdAt: number | null }) {
  const v = viewsCount(views);
  const age = ageShort(createdAt);
  return (
    <span className="card-stats">
      <span className="stat" title="المشاهدات" aria-label={`${v} مشاهدة`}>
        <svg {...ICON}>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {v}
      </span>
      {age && (
        <span className="stat" title="مدة الإضافة" aria-label={age === "الآن" ? "أُضيف الآن" : `منذ ${age}`}>
          <svg {...ICON}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {age}
        </span>
      )}
    </span>
  );
}
