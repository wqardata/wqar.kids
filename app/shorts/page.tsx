import type { Metadata } from "next";
import ShortsFeed from "@/components/ShortsFeed";

export const metadata: Metadata = { title: "قصيرة" };

export default function Shorts() {
  return <ShortsFeed />;
}
