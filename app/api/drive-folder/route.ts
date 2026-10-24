import { NextResponse, type NextRequest } from "next/server";
import { DRIVE_ID, stripExtension } from "@/lib/drive";
import { folderNamePublic, listFolderPublic } from "@/lib/driveFolderPublic";
import { adminFromToken, bearer } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 500;
const MAX_FOLDERS = 40;
const MAX_DEPTH = 3;
const FOLDER = "application/vnd.google-apps.folder";

type DriveFile = { id: string; name: string; mimeType: string; videoMediaMetadata?: { durationMillis?: string } };
export type FolderVideo = { id: string; name: string; title: string; duration: number | null; path: string };

/** عبر Drive API (يتطلب DRIVE_API_KEY). يعيد null إن تعذّر لأي سبب كي نجرّب الطريقة العامة بدل الفشل. */
async function listFolderApi(folderId: string, key: string): Promise<DriveFile[] | null> {
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
    try {
      const r = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!r.ok) return null;
      const j = (await r.json()) as { files?: DriveFile[]; nextPageToken?: string };
      out.push(...(j.files ?? []));
      if (!j.nextPageToken) break;
      token = j.nextPageToken;
    } catch {
      return null;
    }
  }
  return out;
}

/** اسم المجلد عبر Drive API (يحتاج المفتاح)، وإلا من الصفحة العامة. */
async function folderName(folderId: string, key: string | undefined): Promise<string> {
  if (key) {
    try {
      const r = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name&supportsAllDrives=true&key=${encodeURIComponent(key)}`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) },
      );
      if (r.ok) {
        const j = (await r.json()) as { name?: string };
        if (j.name) return j.name.slice(0, 100);
      }
    } catch {
      /* نجرّب الصفحة العامة */
    }
  }
  return (await folderNamePublic(folderId)) ?? "";
}

/** بدون مفتاح: نقرأ صفحة المجلد العامة المضمّنة (تعرض الاسم والمعرّف دون المدة). */
async function listFolderNoKey(folderId: string): Promise<DriveFile[] | null> {
  const items = await listFolderPublic(folderId);
  if (!items) return null;
  return items.map((i) => ({ id: i.id, name: i.name, mimeType: i.isFolder ? FOLDER : i.isVideo ? "video/*" : "application/octet-stream" }));
}

export async function GET(req: NextRequest) {
  const who = await adminFromToken(bearer(req));
  if ("error" in who) {
    return who.error === "unauthorized"
      ? NextResponse.json({ error: "غير مصرّح. سجّل الدخول أولًا." }, { status: 401 })
      : NextResponse.json({ error: "هذا الحساب غير مخوّل." }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const deep = req.nextUrl.searchParams.get("deep") === "1";
  if (!DRIVE_ID.test(id)) return NextResponse.json({ error: "رابط المجلد غير صالح." }, { status: 400 });

  const key = process.env.DRIVE_API_KEY;
  const videos: FolderVideo[] = [];
  let skipped = 0;
  let truncated = false;
  let folders = 0;
  let usedApi = false;
  let unreadable = false;
  const queue: { id: string; path: string; depth: number }[] = [{ id, path: "", depth: 0 }];

  while (queue.length) {
    const cur = queue.shift() as { id: string; path: string; depth: number };
    if (folders++ >= MAX_FOLDERS) {
      truncated = true;
      break;
    }
    // الأفضل Drive API إن وُجد المفتاح (يعطي المدة)؛ وإلا أو إن رفضه درايف نقرأ الصفحة العامة.
    let res: DriveFile[] | null = null;
    if (key) {
      res = await listFolderApi(cur.id, key);
      if (res) usedApi = true;
    }
    if (!res) res = await listFolderNoKey(cur.id);
    if (!res) {
      // فشل المجلد الجذر = خطأ للمستخدم؛ فشل مجلد فرعي = نتجاوزه ونكمل.
      if (cur.depth === 0) unreadable = true;
      else skipped++;
      continue;
    }
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

  if (unreadable) {
    return NextResponse.json(
      { error: "تعذّر قراءة المجلد. تأكد أن مشاركته «أي شخص لديه الرابط – مشاهد» وأن الرابط صحيح، ثم حاول مجددًا." },
      { status: 400 },
    );
  }

  videos.sort((a, b) => a.path.localeCompare(b.path, "ar") || a.name.localeCompare(b.name, "ar", { numeric: true }));
  return NextResponse.json({ videos, skipped, truncated, usedApi, folderName: await folderName(id, key) });
}
