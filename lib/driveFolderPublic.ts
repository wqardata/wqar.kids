// قراءة محتويات مجلد درايف العام بلا مفتاح API، عبر صفحة العرض المضمّن التي يستعملها جوجل نفسه:
//   https://drive.google.com/embeddedfolderview?id=<ID>#list
// تعرض لكل عنصر الاسم والمعرّف ونوعه (أيقونة)، ولا تعرض المدة. الصفحة غير موثّقة رسميًا، فالمحلّل
// أدناه متساهل عمدًا (يعتمد على الروابط والأيقونات لا على بنية HTML الدقيقة) ويعيد null عند أي فشل.
import { DRIVE_ID } from "./drive";

export type PublicItem = { id: string; name: string; isFolder: boolean; isVideo: boolean };

const VIDEO_EXT = /\.(mp4|mkv|mov|avi|webm|m4v|wmv|flv|mpg|mpeg|3gp)$/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** يحلّل HTML صفحة العرض المضمّن ويعيد العناصر (مفصولة عن الشبكة ليسهل اختبارها). */
export function parseEmbeddedFolder(html: string): PublicItem[] {
  const items: PublicItem[] = [];
  const seen = new Set<string>();
  // كل عنصر في كتلة تبدأ بـ id="entry-<ID>" وتنتهي قبل العنصر التالي.
  const parts = html.split(/(?=<div[^>]+id="entry-)/);
  for (const block of parts) {
    const idm = block.match(/^<div[^>]+id="entry-([A-Za-z0-9_-]+)"/);
    if (!idm || !DRIVE_ID.test(idm[1]) || seen.has(idm[1])) continue;
    const id = idm[1];
    const titleM = block.match(/class="flip-entry-title"[^>]*>([\s\S]*?)<\/div>/);
    const name = decodeEntities((titleM?.[1] ?? "").replace(/<[^>]+>/g, "")).trim();
    if (!name) continue;
    const href = block.match(/href="([^"]+)"/)?.[1] ?? "";
    const icon = block.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? "";
    const isFolder = /\/folders\//.test(href) || /vnd\.google-apps\.folder|\/folder/i.test(icon);
    const isVideo = !isFolder && (/\/type\/video\//i.test(icon) || /mime=video|video%2F/i.test(icon) || VIDEO_EXT.test(name));
    seen.add(id);
    items.push({ id, name, isFolder, isVideo });
  }
  return items;
}

/** اسم المجلد العام من عنوان صفحة العرض المضمّن (null إن تعذّر). */
export async function folderNamePublic(folderId: string): Promise<string | null> {
  if (!DRIVE_ID.test(folderId)) return null;
  try {
    const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`, {
      cache: "no-store",
      headers: { "accept-language": "ar,en;q=0.8", "user-agent": "Mozilla/5.0 (compatible; VideoSite/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const m = (await r.text()).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const t = m ? decodeEntities(m[1]).trim() : "";
    return t && !/^(google drive|drive|sign in)/i.test(t) ? t.slice(0, 100) : null;
  } catch {
    return null;
  }
}

/** يجلب محتويات المجلد العام. null = تعذّر (خاص، غير موجود، أو غيّر جوجل الصفحة). */
export async function listFolderPublic(folderId: string): Promise<PublicItem[] | null> {
  if (!DRIVE_ID.test(folderId)) return null;
  try {
    const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`, {
      cache: "no-store",
      headers: { "accept-language": "ar,en;q=0.8", "user-agent": "Mozilla/5.0 (compatible; VideoSite/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const items = parseEmbeddedFolder(html);
    // مجلد فارغ فعلًا يعطي صفحة صالحة بلا عناصر؛ نميّزه عن صفحة تسجيل الدخول (مجلد خاص) بعلامة العرض.
    if (items.length === 0 && !/class="flip-entries"|id="folder-view"/i.test(html)) return null;
    return items;
  } catch {
    return null;
  }
}
