import type { Metadata } from "next";
import RadioPlayer from "@/components/RadioPlayer";

export const metadata: Metadata = { title: "إذاعة" };

export default function Radio() {
  return <RadioPlayer />;
}
