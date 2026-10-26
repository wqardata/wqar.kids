// معرّف فيديو يوتيوب: 11 حرفًا (حروف وأرقام و _ و -).
export const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** يستخرج معرّف الفيديو من أي صيغة رابط يوتيوب شائعة (watch / youtu.be / shorts / embed / live / m.) أو من المعرّف نفسه. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (YT_ID.test(s)) return s;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
      id = m ? m[1] : null;
    }
  }
  return id && YT_ID.test(id) ? id : null;
}

/** بداية التشغيل (ثوانٍ) إن وُجدت في الرابط: ?t=90 أو ?t=1m30s أو &start=90. */
export function parseYouTubeStart(input: string): number {
  try {
    const u = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    const t = u.searchParams.get("t") ?? u.searchParams.get("start") ?? "";
    if (/^\d+s?$/.test(t)) return parseInt(t, 10);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (m && t) return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
  } catch { /* رابط غير صالح */ }
  return 0;
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** عنوان الفيديو من واجهة oEmbed العامة (تعمل بلا مفتاح). يعيد null عند الفشل (فيكتب المشرف العنوان يدويًا). */
export async function fetchYouTubeTitle(id: string): Promise<string | null> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string };
    return j.title?.trim() || null;
  } catch {
    return null;
  }
}
