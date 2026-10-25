"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

/** يعرض المحتوى للمسجَّلين فقط؛ غيرهم يرون دعوة لتسجيل الدخول. */
export default function MembersGate({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth();
  if (!configured) return <>{children}</>;
  if (loading) return <p className="empty-note" role="status">جارٍ التحميل…</p>;
  if (!user) {
    return (
      <div className="empty">
        <p>هذه الصفحة للمستخدمين المسجّلين فقط.</p>
        <Link href="/login" className="btn">تسجيل الدخول</Link>
      </div>
    );
  }
  return <>{children}</>;
}
