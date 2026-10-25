"use client";

import { useState, type FormEvent } from "react";

export default function ContactForm({ email }: { email: string }) {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const subject = String(f.get("subject") ?? "").slice(0, 150);
    const body = `${String(f.get("message") ?? "").slice(0, 3000)}\n\n— ${String(f.get("name") ?? "").slice(0, 80)}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <label>
        الاسم
        <input name="name" required maxLength={80} autoComplete="name" />
      </label>
      <label>
        الموضوع
        <input name="subject" required maxLength={150} />
      </label>
      <label>
        رسالتك
        <textarea name="message" required rows={6} maxLength={3000} />
      </label>
      <button type="submit">إرسال</button>
      {sent && <p role="status" className="note">سيُفتح تطبيق البريد لديك لإرسال الرسالة.</p>}
    </form>
  );
}
