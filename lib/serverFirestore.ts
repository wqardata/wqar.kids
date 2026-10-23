// وصول الخادم إلى Firestore بحساب خدمة (Service Account): يتجاوز قواعد Firestore تمامًا،
// فلا نحتاج «قواعد» لما يمرّ عبر واجهاتنا (مثل البلاغات). يُفعَّل بالمتغير FIREBASE_SERVICE_ACCOUNT.
import { SignJWT, importPKCS8 } from "jose";
import { decodeFields } from "./serverSettings";

type ServiceAccount = { client_email: string; private_key: string };

function loadAccount(): ServiceAccount | null {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? "").trim();
  if (!raw) return null;
  try {
    // يقبل JSON كما نزل من Firebase، أو JSON مشفّرًا base64 (أسهل في بعض لوحات الاستضافة).
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(text) as Partial<ServiceAccount>;
    if (typeof j.client_email !== "string" || typeof j.private_key !== "string") return null;
    return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function serviceAccountConfigured(): boolean {
  return loadAccount() !== null && Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp - 60_000 > Date.now()) return cached.token;
  const acc = loadAccount();
  if (!acc) throw new Error("no-service-account");
  const key = await importPKCS8(acc.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/datastore" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(acc.client_email)
    .setSubject(acc.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`token-${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

const base = () => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "")}/databases/(default)/documents`;

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  return fetch(`${base()}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "content-type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
}

export type FsDoc = { id: string; data: Record<string, unknown> };
type Raw = { name: string; fields?: Record<string, never> };
const toDoc = (r: Raw): FsDoc => ({ id: r.name.split("/").pop() as string, data: decodeFields(r.fields ?? {}) });

/** قيم بسيطة → حقول Firestore. Date تصبح timestamp. */
function encode(v: Record<string, string | number | boolean | Date>) {
  const fields: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    fields[k] =
      x instanceof Date ? { timestampValue: x.toISOString() }
      : typeof x === "string" ? { stringValue: x }
      : typeof x === "boolean" ? { booleanValue: x }
      : Number.isInteger(x) ? { integerValue: String(x) }
      : { doubleValue: x };
  }
  return fields;
}

export async function fsGet(coll: string, id: string): Promise<FsDoc | null> {
  const r = await call(`/${coll}/${encodeURIComponent(id)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`fs-get-${r.status}`);
  return toDoc((await r.json()) as Raw);
}

export async function fsCreate(coll: string, v: Record<string, string | number | boolean | Date>): Promise<string> {
  const r = await call(`/${coll}`, { method: "POST", body: JSON.stringify({ fields: encode(v) }) });
  if (!r.ok) throw new Error(`fs-create-${r.status}`);
  return toDoc((await r.json()) as Raw).id;
}

export async function fsList(coll: string, orderBy: string, pageSize = 100): Promise<FsDoc[]> {
  const r = await call(`/${coll}?pageSize=${pageSize}&orderBy=${encodeURIComponent(orderBy)}`);
  if (!r.ok) throw new Error(`fs-list-${r.status}`);
  const j = (await r.json()) as { documents?: Raw[] };
  return (j.documents ?? []).map(toDoc);
}

export async function fsPatch(coll: string, id: string, v: Record<string, string | number | boolean | Date>): Promise<void> {
  const mask = Object.keys(v).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const r = await call(`/${coll}/${encodeURIComponent(id)}?${mask}&currentDocument.exists=true`, { method: "PATCH", body: JSON.stringify({ fields: encode(v) }) });
  if (!r.ok) throw new Error(`fs-patch-${r.status}`);
}

export async function fsDelete(coll: string, id: string): Promise<void> {
  const r = await call(`/${coll}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error(`fs-delete-${r.status}`);
}
