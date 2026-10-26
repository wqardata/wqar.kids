"use client";
import { useEffect, useState } from "react";
import { AUDIO_PROXY_ON, proxyAudioUrl, resolveAudioSrc } from "@/lib/adhkarAudio";
import { DRIVE_ID } from "@/lib/drive";
import { useAuth } from "@/lib/auth";

/**
 * مشغّل تجربة صوت في لوحة التحكم: يجرّب الرابط المباشر من درايف، وإن رفضه المتصفح يجرّب المسار عبر الموقع (بتوكن المشرف،
 * فيعمل حتى لملف لم يُحفظ بعد). onFail يُستدعى إن فشل الاثنان.
 */
export default function TestAudio({ value, onFail }: { value: string; onFail: () => void }) {
  const { user } = useAuth();
  const [src, setSrc] = useState(() => resolveAudioSrc(value));
  const [viaProxy, setViaProxy] = useState(false);

  useEffect(() => {
    setSrc(resolveAudioSrc(value));
    setViaProxy(false);
  }, [value]);

  async function onError() {
    if (!viaProxy && AUDIO_PROXY_ON && DRIVE_ID.test(value) && user) {
      setViaProxy(true);
      try {
        const token = await user.getIdToken();
        setSrc(`${proxyAudioUrl(value)}&token=${encodeURIComponent(token)}`);
        return;
      } catch { /* نكمل إلى الفشل */ }
    }
    onFail();
  }

  return <audio controls autoPlay preload="none" src={src} onError={() => void onError()} style={{ width: "100%" }} />;
}
