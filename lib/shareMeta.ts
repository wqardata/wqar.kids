import type { Metadata } from "next";
import { IDENTITY } from "./identity";
import { decodeFields, getServerSettings } from "./serverSettings";
import { driveThumbnail } from "./drive";

/**
 * بيانات المعاينة (Open Graph / Twitter) على الخادم.
 * صفحات الفيديو والمجموعة تُرسَم في المتصفح، فلا يرى زاحف واتساب/فيسبوك/تلجرام/إكس إلا ما في <head> القادم من الخادم.
 * هنا نقرأ المستند من Firestore (القراءة عامة) ونبني الوسوم منه.
 */

type Fields = Record<string, unknown>;

/**
 * أصل الموقع (https://الدومين) من متغيرات البيئة فقط: NEXT_PUBLIC_SITE_URL ثم متغيرات فيرسل.
 * عمدًا لا نقرأ ترويسة الطلب (headers) لأنها تجعل الصفحة تُرسَم عند كل زيارة فيزيد استهلاك فيرسل.
 */
export function siteOrigin(): URL | undefined {
  const cands = [process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL];
  for (const c of cands) {
    const t = c?.trim();
    if (!t) continue;
    try {
      return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    } catch {
      /* قيمة غير صالحة: نجرّب التالي */
    }
  }
  return undefined;
}

/** يقرأ مستندًا من Firestore عبر REST (null إن لم يوجد أو تعذّرت القراءة). */
async function readDoc(coll: string, id: string): Promise<Fields | null> {
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!pid || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents/${coll}/${id}${key ? `?key=${encodeURIComponent(key)}` : ""}`;
    const r = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { fields?: Parameters<typeof decodeFields>[0] };
    return decodeFields(j.fields ?? {});
  } catch {
    return null;
  }
}

const str = (d: Fields, k: string) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** رابط الصورة المسموح نشره: داخلي (/…) أو https فقط. */
function safeImage(u: string): string {
  return /^(\/(?!\/)|https:\/\/)/.test(u) && u.length <= 600 ? u : "";
}

type Base = { title: string; description: string; image: string; path: string; type: "video.other" | "website" };

async function build(b: Base): Promise<Metadata> {
  const s = await getServerSettings();
  const origin = siteOrigin();
  const siteName = s.siteName;
  const image = safeImage(b.image) || IDENTITY.icon512;
  const description = clip(b.description || s.siteDescription, 200);
  return {
    ...(origin ? { metadataBase: origin } : {}),
    title: b.title,
    description,
    alternates: { canonical: b.path },
    openGraph: {
      type: b.type,
      siteName,
      title: b.title,
      description,
      url: b.path,
      locale: "ar_AR",
      images: [{ url: image, alt: b.title }],
    },
    twitter: { card: "summary_large_image", title: b.title, description, images: [image] },
  };
}

/** معاينة صفحة فيديو /v/[id]. الفيديو المخفي أو المفقود يأخذ معاينة عامة بلا تسريب عنوانه. */
export async function videoMetadata(id: string): Promise<Metadata> {
  const d = await readDoc("videos", id);
  if (!d || d.hidden === true || (typeof d.clipStart === "number" && typeof d.clipEnd === "number")) {
    return { title: "مشاهدة" };
  }
  const title = str(d, "title") || "مشاهدة";
  const driveId = str(d, "driveId");
  const youtubeId = str(d, "youtubeId");
  const thumb = safeImage(str(d, "thumbnail"));
  const image =
    thumb ||
    (/^[A-Za-z0-9_-]{11}$/.test(youtubeId) ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : "") ||
    (/^[A-Za-z0-9_-]{10,}$/.test(driveId) ? driveThumbnail(driveId, 1280) : "");
  const series = str(d, "seriesName");
  return build({
    title,
    description: str(d, "description") || (series ? `${series} — ${title}` : ""),
    image,
    path: `/v/${id}`,
    type: "video.other",
  });
}

/** معاينة صفحة مجموعة /series/[id]: صورتها المخصّصة، وإلا صورة فيديو الغلاف. */
export async function seriesMetadata(id: string): Promise<Metadata> {
  const d = await readDoc("series", id);
  if (!d) return { title: "مجموعة" };
  const name = str(d, "name") || "مجموعة";
  let image = safeImage(str(d, "coverImage")) || safeImage(str(d, "avatarUrl"));
  const coverId = str(d, "coverVideoId");
  if (!image && coverId) {
    const v = await readDoc("videos", coverId);
    if (v && v.hidden !== true) image = safeImage(str(v, "thumbnail"));
  }
  return build({ title: name, description: "", image, path: `/series/${id}`, type: "website" });
}

/** معاينة صفحة تصنيف /category/[id]: الاسم مع الصورة الافتراضية للموقع. */
export async function categoryMetadata(id: string): Promise<Metadata> {
  const d = await readDoc("categories", id);
  if (!d) return { title: "تصنيف" };
  return build({ title: str(d, "name") || "تصنيف", description: "", image: "", path: `/category/${id}`, type: "website" });
}
