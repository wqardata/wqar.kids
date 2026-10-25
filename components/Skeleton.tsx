
/** بطاقات هيكلية (ظل متحرّك) تظهر بدل «جارٍ التحميل» ريثما يصل المحتوى. */
export function SkelCards({ n, shorts = false }: { n: number; shorts?: boolean }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <li key={`sk-${i}`} className="skel-card" aria-hidden="true">
          <div className="thumb skel" />
          {!shorts && (
            <>
              <div className="skel skel-line" />
              <div className="skel skel-line skel-line--s" />
            </>
          )}
        </li>
      ))}
    </>
  );
}

export function SkeletonGrid({ n = 8, shorts = false }: { n?: number; shorts?: boolean }) {
  return (
    <div role="status" aria-busy="true" aria-label="جارٍ التحميل">
      <ul className={shorts ? "grid grid--shorts" : "grid"}>
        <SkelCards n={n} shorts={shorts} />
      </ul>
    </div>
  );
}

export function SkeletonRows({ n = 6 }: { n?: number }) {
  return (
    <div className="groups" role="status" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skel skel-row" aria-hidden="true" />
      ))}
    </div>
  );
}

/** هيكل صفحة المشاهدة: مشغّل + عنوان + سطور. */
export function SkeletonWatch() {
  return (
    <div className="watch" role="status" aria-busy="true" aria-label="جارٍ التحميل">
      <div>
        <div className="skel skel-player" />
        <div className="skel skel-line skel-line--title" />
        <div className="skel skel-line skel-line--s" />
      </div>
      <div className="suggest-list">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sug" aria-hidden="true">
            <div className="skel sug-thumb" />
            <div>
              <div className="skel skel-line" />
              <div className="skel skel-line skel-line--s" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonSuggest() {
  return (
    <div className="suggest-list" role="status" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="sug" aria-hidden="true">
          <div className="skel sug-thumb" />
          <div>
            <div className="skel skel-line" />
            <div className="skel skel-line skel-line--s" />
          </div>
        </div>
      ))}
    </div>
  );
}
