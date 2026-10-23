import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/data";
import ContactForm from "./ContactForm";

export const metadata: Metadata = { title: "تواصل معنا" };

export default function Contact() {
  return (
    <div className="prose">
      <h1>تواصل معنا</h1>
      {CONTACT_EMAIL ? (
        <>
          <p>يسعدنا سماع اقتراحاتك وملاحظاتك.</p>
          <ContactForm email={CONTACT_EMAIL} />
        </>
      ) : (
        <p className="note" role="status">
          نموذج التواصل غير مفعّل بعد. أضف بريدك في <code dir="ltr">CONTACT_EMAIL</code> داخل <code dir="ltr">lib/data.ts</code>.
        </p>
      )}
    </div>
  );
}
