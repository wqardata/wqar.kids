"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="empty" role="alert">
      <h1>حدث خطأ غير متوقع</h1>
      <p>تعذّر تحميل الصفحة. حاول مرة أخرى.</p>
      <button type="button" className="btn" onClick={reset}>إعادة المحاولة</button>
    </div>
  );
}
