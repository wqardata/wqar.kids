import type { Metadata } from "next";
import VideoView from "./VideoView";
import { videoMetadata } from "@/lib/shareMeta";

type Props = { params: Promise<{ id: string }> };

// معاينة الرابط (واتساب/فيسبوك/تلجرام…) تُبنى على الخادم من مستند الفيديو.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return videoMetadata(id);
}

export default async function VideoPage({ params }: Props) {
  const { id } = await params;
  return <VideoView id={id} />;
}
