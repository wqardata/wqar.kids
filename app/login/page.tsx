import type { Metadata } from "next";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function Login() {
  return (
    <div className="auth">
      <h1>تسجيل الدخول</h1>
      <p className="note" role="status">
        تسجيل الدخول قيد البناء، وسيُفعَّل في الخطوات القادمة.
      </p>
      <form>
        <fieldset disabled>
          <label>
            البريد الإلكتروني
            <input type="email" name="email" autoComplete="email" dir="ltr" />
          </label>
          <label>
            كلمة المرور
            <input type="password" name="password" autoComplete="current-password" dir="ltr" />
          </label>
          <button type="submit">دخول</button>
        </fieldset>
      </form>
    </div>
  );
}
