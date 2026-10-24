"use client";
import { useSettings } from "@/lib/settings";
import ContactForm from "./ContactForm";

export default function ContactSection() {
  const { settings } = useSettings();
  return settings.contactEmail ? (
    <>
      <p>يسعدنا سماع اقتراحاتك وملاحظاتك.</p>
      <ContactForm email={settings.contactEmail} />
    </>
  ) : (
    <p className="note" role="status">نموذج التواصل غير مفعّل حاليًا.</p>
  );
}
