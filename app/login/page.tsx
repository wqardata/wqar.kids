import type { Metadata } from "next";
import LoginPanel from "./LoginPanel";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function Login({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return (
    <div className="auth">
      <LoginPanel initialMode={mode === "signup" ? "signup" : "signin"} />
    </div>
  );
}
