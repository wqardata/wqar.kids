import type { Metadata } from "next";
import LoginPanel from "./LoginPanel";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function Login() {
  return (
    <div className="auth">
      <LoginPanel />
    </div>
  );
}
