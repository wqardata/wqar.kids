import type { Metadata } from "next";
import LoginPanel from "./LoginPanel";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function Login({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return (
    <div className="auth">
      <h1>تسجيل الدخول أو إنشاء حساب</h1>
      <LoginPanel initialMode={mode === "signup" ? "signup" : "signin"} />
    </div>
  );
}
