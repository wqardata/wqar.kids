import { NextResponse, type NextRequest } from "next/server";
import { DRIVE_ID, stripExtension } from "@/lib/drive";
import { bearer, emailFromToken, isAdminEmail } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 500;
const MAX_FOLDERS = 40;
const MAX_DEPTH = 3;
const FOLDER = "application/vnd.google-apps.folder";

type DriveFile = { id: string; name: string; mimeType: string; videoMediaMetadata?: { durationMillis?: string } };
export type FolderVideo = { id: string; name: string; title: string; duration: number | null; path: string };

async function listFolder(folderId: string, key: string): Promise<DriveFile[] | { error: string; status: number }> {
  const out: DriveFile[] = [];
  let token = "";
  for (let page = 0; page < 10; page++) {
    const u = new URL("https://www.googleapis.com/drive/v3/files");
    u.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
    u.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,videoMediaMetadata(durationMillis))");
    u.searchParams.set("pageSize", "1000");
    u.searchParams.set("supportsAllDrives", "true");
    u.searchParams.set("includeItemsFromAllDrives", "true");
    u.searchParams.set("key", key);
    if (token) u.searchParams.set("pageToken", token);
    const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (r.status === 404 || r.status === 403 || r.status === 400) {
      return { error: "تعذّر قراءة المجلد. اضبط مشاركته على «أي شخص لديه الرابط – مشاهد» وتأكد من تفعيل Google Drive API لمفتاحك.", status: 400 };
    }
    if (!r.ok) return { error: "تعذّر الاتصال بدرايف. حاول لاحقًا.", status: 502 };
    const j = (await r.json()) as { files?: DriveFile[]; nextPageToken?: string };
    out.push(...(j.files ?? []));
    if (!j.nextPageToken) break;
    token = j.nextPageToken;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const email = await emailFromToken(bearer(req));
  if (!email) return NextResponse.json({ error: "غير مصرّح. سجّل الدخول أولًا." }, { status: 401 });
  if (!isAdminEmail(email)) return NextResponse.json({ error: "هذا الحساب غير مخوّل." }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const deep = req.nextUrl.searchParams.get("deep") === "1";
  if (!DRIVE_ID.test(id)) return NextResponse.json({ error: "رابط المجلد غير صالح." }, { status: 400 });

  const key = process.env.DRIVE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "استيراد مجلد يتطلب مفتاح Google Drive API: أضف DRIVE_API_KEY في متغيرات البيئة على Vercel (انظر README) ثم أعد النشر." },
      { status: 501 },
    );
  }

  const videos: FolderVideo[] = [];
  let skipped = 0;
  let truncated = false;
  let folders = 0;
  const queue: { id: string; path: string; depth: number }[] = [{ id, path: "", depth: 0 }];

  while (queue.length) {
    const cur = queue.shift() as { id: string; path: string; depth: number };
    if (folders++ >= MAX_FOLDERS) {
      truncated = true;
      break;
    }
    const res = await listFolder(cur.id, key);
    if (!Array.isArray(res)) return NextResponse.json({ error: res.error }, { status: res.status });
    for (const f of res) {
      if (f.mimeType === FOLDER) {
        if (deep && cur.depth < MAX_DEPTH) queue.push({ id: f.id, path: cur.path ? `${cur.path} / ${f.name}` : f.name, depth: cur.depth + 1 });
        else skipped++;
      } else if (f.mimeType.startsWith("video/")) {
        if (videos.length >= MAX_FILES) {
          truncated = true;
          continue;
        }
        const ms = Number(f.videoMediaMetadata?.durationMillis);
        videos.push({
          id: f.id,
          name: f.name,
          title: stripExtension(f.name),
          duration: Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null,
          path: cur.path,
        });
      } else skipped++;
    }
  }

  videos.sort((a, b) => a.path.localeCompare(b.path, "ar") || a.name.localeCompare(b.name, "ar", { numeric: true }));
  return NextResponse.json({ videos, skipped, truncated });
}
