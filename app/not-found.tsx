import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty">
      <h1>الصفحة غير موجودة</h1>
      <p>الرابط الذي فتحته غير صحيح أو تم نقله.</p>
      <Link href="/" className="btn">العودة إلى الرئيسية</Link>
    </div>
  );
}
