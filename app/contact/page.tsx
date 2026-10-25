import type { Metadata } from "next";
import ContactSection from "./ContactSection";

export const metadata: Metadata = { title: "تواصل معنا" };

export default function Contact() {
  return (
    <div className="prose">
      <h1>تواصل معنا</h1>
      <ContactSection />
    </div>
  );
}
